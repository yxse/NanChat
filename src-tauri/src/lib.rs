use keyring::{error::Error as KeyringError, Entry as KeyringEntry};
use serde::{Deserialize, Serialize};
use tauri::webview::WebviewBuilder;
use tauri::window::WindowBuilder;
use tauri::{
    AppHandle, Emitter, Listener, LogicalPosition, LogicalSize, Manager, WebviewUrl, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::{SystemTime, UNIX_EPOCH};

/// Height (in logical pixels) of the custom top bar rendered above the
/// in-app browser content webview.
const BROWSER_TOOLBAR_HEIGHT: f64 = 44.0;

// Custom error type to handle conversion
#[derive(Debug, Serialize, Deserialize)]
enum AppError {
    KeyringError(String),
    Other(String),
}
// Convert KeyringError to our custom AppError
impl From<KeyringError> for AppError {
    fn from(error: KeyringError) -> Self {
        AppError::KeyringError(error.to_string())
    }
}

#[tauri::command]
fn save_secret(service: String, username: String, password: String) -> Result<(), AppError> {
    // Explicitly handle the Result from KeyringEntry::new()
    let entry = KeyringEntry::new(&service, &username)?;
    entry.set_password(&password)?;
    Ok(())
}
#[tauri::command]
fn get_secret(service: String, username: String) -> Result<String, AppError> {
    // Similar pattern for get_secret
    let entry = KeyringEntry::new(&service, &username)?;
    let password = entry.get_password()?;
    Ok(password)
}
// delete keyring entry

#[tauri::command]
fn delete_secret(service: String, username: String) -> Result<(), AppError> {
    let entry = KeyringEntry::new(&service, &username)?;
    entry.delete_credential()?;
    Ok(())
}

fn gen_nonce(label: &str) -> String {
    let mut hasher = DefaultHasher::new();
    label.hash(&mut hasher);
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[tauri::command]
async fn open_browser_window(
    app: AppHandle,
    label: String,
    url: String,
    title: String,
    width: f64,
    height: f64,
    x: Option<f64>,
    y: Option<f64>,
    maximized: bool,
) -> Result<(), String> {
    let parsed_url = url.parse::<tauri::Url>().map_err(|e| e.to_string())?;
    if parsed_url.scheme() != "https" {
        return Err("only https URLs are allowed".into());
    }
    let toolbar_label = format!("{}-toolbar", label);
    let content_label = format!("{}-content", label);
    let nonce = gen_nonce(&label);
    let spa_event = format!("browser-spa-navigation-{}-{}", content_label, nonce);

    // 1. Create the host window (no webview yet) so we can stack two child
    //    webviews inside it: a custom title bar and the actual browser content.
    //    Native decorations are disabled so the title bar webview can render
    //    our own window controls (Option A: custom title bar).
    let mut win_builder = WindowBuilder::new(&app, &label)
        .title(&title)
        .inner_size(width, height)
        .decorations(false)
        .maximized(maximized);
    if let (Some(x), Some(y)) = (x, y) {
        win_builder = win_builder.position(x, y);
    }
    let window = win_builder.build().map_err(|e| e.to_string())?;

    // Use the *actual* inner size (matters when the window is maximized) to
    // lay out the two child webviews.
    let inner = window.inner_size().map_err(|e| e.to_string())?;
    let scale = window.scale_factor().unwrap_or(1.0);
    let logical_w = inner.width as f64 / scale;
    let logical_h = inner.height as f64 / scale;

    // 2. Custom title bar webview (our own local page), pinned to the top.
    //    We inject the current URL and the host window label so the title bar
    //    can drive the window controls (minimize/maximize/close).
    let toolbar_init = format!(
        "window.__BROWSER_URL__ = {}; window.__WINDOW_LABEL__ = {}; window.__BROWSER_TITLE__ = {};",
        serde_json::to_string(&url).unwrap_or_else(|_| "\"\"".into()),
        serde_json::to_string(&label).unwrap_or_else(|_| "\"\"".into()),
        serde_json::to_string(&title).unwrap_or_else(|_| "\"\"".into()),
    );
    let toolbar_wv = window
        .add_child(
            WebviewBuilder::new(
                &toolbar_label,
                WebviewUrl::App("browser-toolbar.html".into()),
            )
            .initialization_script(&toolbar_init),
            LogicalPosition::new(0.0, 0.0),
            LogicalSize::new(logical_w, BROWSER_TOOLBAR_HEIGHT),
        )
        .map_err(|e| e.to_string())?;

    // 3. Content webview (the external site), filling the area below the bar.
    let app_nav = app.clone();
    let nav_window = window.clone();
    let nav_toolbar_label = toolbar_label.clone();
    let content_wv = window
        .add_child(
            WebviewBuilder::new(&content_label, WebviewUrl::External(parsed_url))
                .devtools(cfg!(debug_assertions))
                .user_agent("NanChat/1.0.0")
                .initialization_script(&nanchat_intercept_script(&spa_event))
                .on_navigation(move |nav_url| {
                    println!("[on_navigation] {}", nav_url);
                    if let Some(main_win) = app_nav.get_webview_window("main") {
                        let _ = main_win.emit("nanchat-navigation", nav_url.to_string());
                    }
                    // Update the OS window title to just the hostname.
                    let nav_title = nav_url.host_str().unwrap_or(nav_url.as_str());
                    let _ = nav_window.set_title(nav_title);
                    // Tell the custom title bar to refresh its displayed URL by
                    // calling a global function we expose in the toolbar page.
                    if let Some(toolbar) = nav_window.get_webview(&nav_toolbar_label) {
                        let js = format!(
                            "window.__setBrowserUrl && window.__setBrowserUrl({});",
                            serde_json::to_string(nav_url.as_str()).unwrap_or_else(|_| "\"\"".into())
                        );
                        let _ = toolbar.eval(&js);
                    }
                    // Keep nanchat.com links inside the main app window.
                    if nav_url.as_str().starts_with("https://nanchat.com") {
                        return false;
                    }
                    true
                }),
            LogicalPosition::new(0.0, BROWSER_TOOLBAR_HEIGHT),
            LogicalSize::new(logical_w, (logical_h - BROWSER_TOOLBAR_HEIGHT).max(0.0)),
        )
        .map_err(|e| e.to_string())?;

    // 4. Keep the two webviews laid out correctly when the window resizes.
    let resize_window = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Resized(size) = event {
            let scale = resize_window.scale_factor().unwrap_or(1.0);
            let w = size.width as f64 / scale;
            let h = size.height as f64 / scale;
            let _ = toolbar_wv.set_size(LogicalSize::new(w, BROWSER_TOOLBAR_HEIGHT));
            let _ = content_wv.set_position(LogicalPosition::new(0.0, BROWSER_TOOLBAR_HEIGHT));
            let _ =
                content_wv.set_size(LogicalSize::new(w, (h - BROWSER_TOOLBAR_HEIGHT).max(0.0)));
        }
    });

    // 5. React to SPA (history API) navigations reported from the content
    //    webview's init script: update the OS window title and the custom
    //    title bar's displayed URL, just like real document navigations.
    let spa_window = window.clone();
    let spa_toolbar_label = toolbar_label.clone();
    window.listen(spa_event, move |event| {
        let raw = event.payload();
        let new_url = serde_json::from_str::<String>(raw).unwrap_or_else(|_| raw.to_string());
        let spa_title = tauri::Url::parse(&new_url)
            .ok()
            .and_then(|u| u.host_str().map(|h| h.to_string()))
            .unwrap_or_else(|| new_url.clone());
        let _ = spa_window.set_title(&spa_title);
        if let Some(toolbar) = spa_window.get_webview(&spa_toolbar_label) {
            let js = format!(
                "window.__setBrowserUrl && window.__setBrowserUrl({});",
                serde_json::to_string(&new_url).unwrap_or_else(|_| "\"\"".into())
            );
            let _ = toolbar.eval(&js);
        }
    });

    Ok(())
}

fn nanchat_intercept_script(spa_event: &str) -> String {
    // spa_event is kept in IIFE closure scope — not exposed as a JS global,
    // so page scripts cannot read it and spoof the event.
    let event_json = serde_json::to_string(spa_event).unwrap_or_else(|_| "\"\"".into());
    format!(
        r#"(function() {{
        var _spaEvent = {};
        var NANCHAT = /^https:\/\/(www\.)?nanchat\.com\//;

        // intercept <a href> and <a target="_blank"> clicks
        document.addEventListener('click', function(e) {{
            var a = e.target.closest('a[href]');
            if (!a) return;
            if (NANCHAT.test(a.href)) {{
                e.preventDefault();
                e.stopPropagation();
                window.location.href = a.href; // forces navigation in this frame -> on_navigation fires
            }}
        }}, true);

        // intercept window.open(url)
        var _open = window.open.bind(window);
        window.open = function(url, target, features) {{
            if (url && NANCHAT.test(String(url))) {{
                window.location.href = String(url); // forces navigation in this frame -> on_navigation fires
                return null;
            }}
            return _open(url, target, features);
        }};

        // Report SPA (history API) URL changes back to the host so the custom
        // title bar and window title can stay in sync. on_navigation only fires
        // for real document loads, not pushState/replaceState.
        var lastUrl = location.href;
        function reportUrl() {{
            if (location.href === lastUrl) return;
            lastUrl = location.href;
            try {{
                window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {{
                    event: _spaEvent,
                    payload: location.href
                }});
            }} catch (err) {{}}
        }}
        var _pushState = history.pushState;
        history.pushState = function() {{
            var r = _pushState.apply(this, arguments);
            reportUrl();
            return r;
        }};
        var _replaceState = history.replaceState;
        history.replaceState = function() {{
            var r = _replaceState.apply(this, arguments);
            reportUrl();
            return r;
        }};
        window.addEventListener('popstate', reportUrl);
        window.addEventListener('hashchange', reportUrl);
    }})();"#,
        event_json
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // usefull for dev, only works on Windows and Linux
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            {
                app.deep_link().register("nan")?;
                app.deep_link().register("nanauth")?;
                app.deep_link().register("nano")?;
                app.deep_link().register("ban")?;
                app.deep_link().register("xdg")?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_secret,
            get_secret,
            delete_secret,
            open_browser_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
