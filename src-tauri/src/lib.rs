use keyring::{error::Error as KeyringError, Entry as KeyringEntry};
use serde::{Deserialize, Serialize};
use tauri::webview::{NewWindowResponse, WebviewBuilder};
use tauri::window::WindowBuilder;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, Window, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Height (in logical pixels) of the custom top bar rendered above the
/// in-app browser content webview.
const BROWSER_TOOLBAR_HEIGHT: f64 = 44.0;

/// How often the content webview URL is polled to catch SPA (history API)
/// navigations, which don't trigger on_navigation.
const BROWSER_URL_POLL_INTERVAL: Duration = Duration::from_millis(500);

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

/// Last page shown in an in-app browser window, sent to the main window as
/// `browser-closed` when the window closes (used for the Discover history).
#[derive(Clone, Serialize)]
struct BrowserPage {
    label: String,
    url: String,
    title: String,
}

/// Payload of `nanchat-navigation`: a link the in-app browser hands over to the
/// main window, and the page that triggered it (used by the Sign screen to tell
/// requests from the site the user is on apart from outside links / QR codes).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NanchatNavigation {
    url: String,
    page_url: String,
}

/// nanchat.com links and NanChat's own deep links (nanauth://, nano:, ...) are
/// handed over to the main app window.
fn is_nanchat_url(url: &tauri::Url) -> bool {
    match url.scheme() {
        "https" => url.host_str() == Some("nanchat.com"),
        "nano" | "nan" | "nanauth" | "ban" | "xdg" | "ana" | "xro" => true,
        _ => false,
    }
}

/// URL of the page currently shown in the content webview. Falls back to the
/// last URL seen by the poller if the webview can't be queried.
fn current_page_url(window: &Window, content_label: &str, page: &Mutex<BrowserPage>) -> String {
    window
        .get_webview(content_label)
        .and_then(|wv| wv.url().ok())
        .map(|url| url.to_string())
        .unwrap_or_else(|| page.lock().unwrap().url.clone())
}

fn emit_nanchat_navigation(app: &AppHandle, url: &tauri::Url, page_url: String) {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.emit(
            "nanchat-navigation",
            NanchatNavigation { url: url.to_string(), page_url },
        );
    }
}

/// URLs the in-app browser content webview may load. Everything else is
/// blocked: plain http, file:, custom schemes and the app's own origin
/// (tauri://localhost, http(s)://tauri.localhost), so a remote page can never
/// turn the content webview into a local, IPC-privileged origin.
fn is_allowed_browser_url(url: &tauri::Url) -> bool {
    match url.scheme() {
        "https" => !matches!(
            url.host_str(),
            Some(host) if host == "localhost" || host.ends_with(".localhost")
        ),
        // In-page frames: macOS and Linux report subframe navigations here too.
        "about" | "blob" | "data" => true,
        _ => false,
    }
}

/// Show `url` in the browser window: OS window title set to the hostname, and
/// the custom title bar refreshed through the global function it exposes.
fn show_browser_url(window: &Window, toolbar_label: &str, url: &tauri::Url) {
    let _ = window.set_title(url.host_str().unwrap_or(url.as_str()));
    if let Some(toolbar) = window.get_webview(toolbar_label) {
        let js = format!(
            "window.__setBrowserUrl && window.__setBrowserUrl({});",
            serde_json::to_string(url.as_str()).unwrap_or_else(|_| "\"\"".into())
        );
        let _ = toolbar.eval(&js);
    }
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

    // On Linux child webviews are packed into the window's GtkBox, which
    // ignores set_size/set_position and splits the height evenly between them.
    // Pin the toolbar to its height so the content webview gets the rest.
    #[cfg(target_os = "linux")]
    let _ = toolbar_wv.with_webview(|platform| {
        use gtk::prelude::*;
        let wv = platform.inner();
        wv.set_size_request(-1, BROWSER_TOOLBAR_HEIGHT as i32);
        if let Some(vbox) = wv.parent().and_then(|p| p.downcast::<gtk::Box>().ok()) {
            vbox.set_child_packing(&wv, false, false, 0, gtk::PackType::Start);
        }
    });

    // 3. Content webview (the external site), filling the area below the bar.
    //    It has no IPC access: no capability grants anything to remote origins.
    let page = Arc::new(Mutex::new(BrowserPage {
        label: label.clone(),
        url: parsed_url.to_string(),
        title: String::new(),
    }));
    let title_page = page.clone();
    let app_new_window = app.clone();
    let new_window_window = window.clone();
    let new_window_content_label = content_label.clone();
    let new_window_page = page.clone();
    let app_nav = app.clone();
    let nav_window = window.clone();
    let nav_toolbar_label = toolbar_label.clone();
    let nav_content_label = content_label.clone();
    let nav_page = page.clone();
    let content_wv = window
        .add_child(
            WebviewBuilder::new(&content_label, WebviewUrl::External(parsed_url))
                .devtools(cfg!(debug_assertions))
                .user_agent("NanChat/1.0.0")
                .initialization_script(NANCHAT_INTERCEPT_SCRIPT)
                // Popups (window.open, target="_blank") never open a webview:
                // nanchat.com goes to the main window, other links to the
                // system browser. Done here because the page has no IPC
                // access to the opener plugin.
                .on_new_window(move |new_url, _features| {
                    if is_nanchat_url(&new_url) {
                        let page_url = current_page_url(
                            &new_window_window,
                            &new_window_content_label,
                            &new_window_page,
                        );
                        emit_nanchat_navigation(&app_new_window, &new_url, page_url);
                    } else if matches!(new_url.scheme(), "http" | "https" | "mailto" | "tel") {
                        let _ = app_new_window.opener().open_url(new_url.as_str(), None::<&str>);
                    }
                    NewWindowResponse::Deny
                })
                .on_document_title_changed(move |_, title| {
                    title_page.lock().unwrap().title = title;
                })
                .on_navigation(move |nav_url| {
                    println!("[on_navigation] {}", nav_url);
                    // Keep nanchat.com links and wallet deep links inside the main app window.
                    if is_nanchat_url(nav_url) {
                        // Still the triggering page: this navigation hasn't started yet.
                        let page_url = current_page_url(&nav_window, &nav_content_label, &nav_page);
                        emit_nanchat_navigation(&app_nav, nav_url, page_url);
                        return false;
                    }
                    if !is_allowed_browser_url(nav_url) {
                        return false;
                    }
                    if nav_url.scheme() == "https" {
                        show_browser_url(&nav_window, &nav_toolbar_label, nav_url);
                    }
                    true
                }),
            LogicalPosition::new(0.0, BROWSER_TOOLBAR_HEIGHT),
            LogicalSize::new(logical_w, (logical_h - BROWSER_TOOLBAR_HEIGHT).max(0.0)),
        )
        .map_err(|e| e.to_string())?;

    // 4. Keep the two webviews laid out correctly when the window resizes.
    //    On close, report the last page to the main window and stop the URL
    //    poller.
    let closed = Arc::new(AtomicBool::new(false));
    let closed_flag = closed.clone();
    let close_page = page.clone();
    let resize_window = window.clone();
    let resize_content_wv = content_wv.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::CloseRequested { .. } => {
            // Catch a navigation the poller hasn't seen yet.
            if let Ok(url) = resize_content_wv.url() {
                close_page.lock().unwrap().url = url.to_string();
            }
        }
        WindowEvent::Destroyed => {
            closed_flag.store(true, Ordering::Relaxed);
            let closed_page = close_page.lock().unwrap().clone();
            let _ = resize_window.emit_to("main", "browser-closed", closed_page);
        }
        WindowEvent::Resized(size) => {
            let scale = resize_window.scale_factor().unwrap_or(1.0);
            let w = size.width as f64 / scale;
            let h = size.height as f64 / scale;
            let _ = toolbar_wv.set_size(LogicalSize::new(w, BROWSER_TOOLBAR_HEIGHT));
            let _ = resize_content_wv
                .set_position(LogicalPosition::new(0.0, BROWSER_TOOLBAR_HEIGHT));
            let _ = resize_content_wv
                .set_size(LogicalSize::new(w, (h - BROWSER_TOOLBAR_HEIGHT).max(0.0)));
        }
        _ => {}
    });

    // 5. Catch SPA (history API) navigations, which on_navigation doesn't see,
    //    by polling the content webview URL from the host side. This replaces
    //    reporting them over IPC so the remote page needs no IPC access at all.
    let poll_window = window.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(BROWSER_URL_POLL_INTERVAL);
        if closed.load(Ordering::Relaxed) {
            break;
        }
        let Ok(current) = content_wv.url() else { break };
        let mut page = page.lock().unwrap();
        if current.as_str() != page.url {
            page.url = current.to_string();
            drop(page);
            show_browser_url(&poll_window, &toolbar_label, &current);
        }
    });

    Ok(())
}

// Keeps nanchat.com links inside the main app: forces them to navigate this
// frame so on_navigation fires and can hand them over to the main window.
// Also routes new-window links through on_new_window (see below). Uses no IPC.
const NANCHAT_INTERCEPT_SCRIPT: &str = r#"(function() {
        var NANCHAT = /^https:\/\/(www\.)?nanchat\.com\//;

        // intercept <a href> and <a target="_blank"> clicks
        document.addEventListener('click', function(e) {
            var a = e.target.closest('a[href]');
            if (!a) return;
            if (NANCHAT.test(a.href)) {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = a.href; // forces navigation in this frame -> on_navigation fires
            }
        }, true);

        // intercept window.open(url)
        var _open = window.open.bind(window);
        window.open = function(url, target, features) {
            if (url && NANCHAT.test(String(url))) {
                window.location.href = String(url); // forces navigation in this frame -> on_navigation fires
                return null;
            }
            return _open(url, target, features);
        };

        // The opener plugin script (injected into every webview) turns these
        // clicks into a plugin:opener IPC call, which remote pages are denied.
        // Claim them first and open a native popup instead, which Rust's
        // on_new_window sends to the system browser. Runs in the bubble phase
        // on document so the page's own handlers can still cancel the click.
        document.addEventListener('click', function(e) {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey) return;
            var a = e.composedPath().find(function(n) {
                return n instanceof Node && n.nodeName.toUpperCase() === 'A';
            });
            if (!a || !a.href || (a.target !== '_blank' && !e.ctrlKey && !e.shiftKey)) return;
            if (['http:', 'https:', 'mailto:', 'tel:'].indexOf(new URL(a.href).protocol) === -1) return;
            e.preventDefault();
            _open(a.href, '_blank');
        });
    })();"#;

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
