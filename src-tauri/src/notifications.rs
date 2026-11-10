// Desktop notifications.
//
// On Windows, tauri-plugin-notification shows toasts without a click handler. Chat toasts are
// built here instead, and the click is handled in this process (the toast's Activated event):
// the main window is restored and brought to the front, then `notification-clicked` is sent to
// it with the chat id. The toasts are kept alive so clicks from the notification center reach
// the app too, while it runs.
// Other platforms use the notification plugin.
//
// Notifications can be turned off and on from the taskbar icon's right-click menu (jump list
// task, Windows): the task launches the app with TOGGLE_ARG, which single-instance forwards to
// the running app (`toggle`). The choice is kept in a file in the app config directory.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};

/// Argument of the jump list task that turns notifications off / on.
pub const TOGGLE_ARG: &str = "--toggle-notifications";
static DISABLED: AtomicBool = AtomicBool::new(false);

fn disabled_flag_file(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("notifications-disabled"))
}

/// At startup: loads the setting and builds the taskbar menu. A launch from the jump list task
/// while the app wasn't running toggles the setting.
pub fn init(app: &AppHandle) {
    let disabled = disabled_flag_file(app).map(|file| file.exists()).unwrap_or(false);
    DISABLED.store(disabled, Ordering::SeqCst);
    if std::env::args().any(|arg| arg == TOGGLE_ARG) {
        toggle(app);
    } else {
        update_taskbar_menu(app);
    }
}

/// Turns all desktop notifications off or on (jump list task).
pub fn toggle(app: &AppHandle) {
    let disabled = !DISABLED.load(Ordering::SeqCst);
    DISABLED.store(disabled, Ordering::SeqCst);
    if let Some(file) = disabled_flag_file(app) {
        let result = if disabled {
            file.parent().map(std::fs::create_dir_all).transpose().and_then(|_| std::fs::write(&file, b""))
        } else {
            std::fs::remove_file(&file).or_else(|e| if e.kind() == std::io::ErrorKind::NotFound { Ok(()) } else { Err(e) })
        };
        if let Err(error) = result {
            log::warn!("cannot save the notifications setting: {error}");
        }
    }
    update_taskbar_menu(app);
    let _ = app.emit_to("main", "notifications-toggled", !disabled);
    // confirmation, shown even when turning them off, without sound
    #[cfg(windows)]
    {
        let text = if disabled { "Notifications turned off" } else { "Notifications turned on" };
        let _ = windows_toast::show_toast(app, "NanChat", text, None, true);
    }
}

fn update_taskbar_menu(app: &AppHandle) {
    #[cfg(windows)]
    {
        let disabled = DISABLED.load(Ordering::SeqCst);
        // COM objects of the shell: on the main (STA) thread
        let _ = app.run_on_main_thread(move || {
            if let Err(error) = jump_list::update(disabled) {
                log::warn!("cannot update the taskbar menu: {error}");
            }
        });
    }
    #[cfg(not(windows))]
    let _ = app;
}

#[tauri::command]
pub fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
    chat_id: Option<String>,
) -> Result<(), String> {
    if DISABLED.load(Ordering::SeqCst) {
        return Ok(()); // turned off from the taskbar menu
    }
    let chat_id = chat_id.filter(|id| is_valid_chat_id(id));
    #[cfg(windows)]
    {
        windows_toast::show_toast(&app, &title, &body, chat_id, false).map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        let _ = chat_id;
        use tauri_plugin_notification::NotificationExt;
        app.notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|e| e.to_string())
    }
}

/// Restores and focuses the main window (notification click, second launch, deep link...).
/// tao's set_focus does nothing while the window is minimized, and Windows refuses
/// SetForegroundWindow to a background process (it flashes the taskbar button instead), so on
/// Windows this is done natively.
pub fn focus_main_window(app: &AppHandle) {
    use tauri::Manager;
    let Some(window) = app.get_webview_window("main") else { return };
    #[cfg(windows)]
    {
        if let Ok(hwnd) = window.hwnd() {
            foreground::bring_to_front(hwnd);
            return;
        }
    }
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

/// To call first thing at startup. When the app is launched again (deep link, shortcut),
/// Windows lets that new process take the foreground, not the running one: the second
/// instance hands its right over before single-instance forwards the launch and exits.
pub fn allow_foreground_handoff() {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::UI::WindowsAndMessaging::{AllowSetForegroundWindow, ASFW_ANY};
        let _ = AllowSetForegroundWindow(ASFW_ANY);
    }
}

/// Chat ids end up in the toast and in an event: only accept plain ids.
fn is_valid_chat_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[cfg(windows)]
mod foreground {
    use std::mem::size_of;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_MENU,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, IsIconic, SetForegroundWindow,
        ShowWindow, SW_RESTORE, SW_SHOW,
    };

    fn log(step: &str) {
        #[cfg(debug_assertions)]
        eprintln!("[notifications] bring to front: {step}");
        #[cfg(not(debug_assertions))]
        let _ = step;
    }

    /// Restores the window, then tries to take the foreground, from the least to the most
    /// intrusive way. A click on a toast normally lets this process do it directly.
    pub fn bring_to_front(hwnd: HWND) {
        unsafe {
            let _ = ShowWindow(hwnd, if IsIconic(hwnd).as_bool() { SW_RESTORE } else { SW_SHOW });
            if SetForegroundWindow(hwnd).as_bool() {
                return log("SetForegroundWindow");
            }
            // The process that sent the last input may take the foreground: a synthetic Alt tap
            // (same trick as tao's set_focus).
            let key = |flags| INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: VK_MENU, dwFlags: flags, ..Default::default() } },
            };
            let inputs = [key(Default::default()), key(KEYEVENTF_KEYUP)];
            SendInput(&inputs, size_of::<INPUT>() as i32);
            if SetForegroundWindow(hwnd).as_bool() {
                return log("SetForegroundWindow after Alt");
            }
            // Last resort: share the input state of the foreground window's thread.
            let foreground_thread = GetWindowThreadProcessId(GetForegroundWindow(), None);
            let current_thread = GetCurrentThreadId();
            if foreground_thread != 0 && foreground_thread != current_thread {
                let _ = AttachThreadInput(current_thread, foreground_thread, true);
                let _ = BringWindowToTop(hwnd);
                let ok = SetForegroundWindow(hwnd).as_bool();
                let _ = AttachThreadInput(current_thread, foreground_thread, false);
                return log(if ok { "AttachThreadInput" } else { "failed" });
            }
            let _ = BringWindowToTop(hwnd);
            log("failed");
        }
    }
}

#[cfg(windows)]
mod windows_toast {
    use std::collections::VecDeque;
    use std::path::{Path, MAIN_SEPARATOR as SEP};
    use std::sync::{Mutex, OnceLock};
    use tauri::{AppHandle, Emitter};
    use windows::core::{IInspectable, HSTRING, PCWSTR};
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::Foundation::TypedEventHandler;
    use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};
    use windows::Win32::System::Registry::{
        RegCloseKey, RegCreateKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
        REG_OPTION_NON_VOLATILE, REG_SZ,
    };

    /// Toasts stay alive while they may still be clicked (popup or notification center): the
    /// Activated event is only raised for live objects.
    const KEEP_TOASTS: usize = 50;
    static TOASTS: Mutex<VecDeque<ToastNotification>> = Mutex::new(VecDeque::new());

    fn escape(text: &str) -> String {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    }

    /// AppUserModelID of the toasts. Installed builds have a Start menu shortcut with the bundle
    /// identifier as id. Builds run from target/ don't: they register a separate id for the
    /// current user (HKCU\Software\Classes\AppUserModelId), so toasts show as "NanChat (dev)"
    /// and their clicks come back to this app, not to PowerShell.
    fn app_id(app: &AppHandle) -> &'static str {
        static APP_ID: OnceLock<String> = OnceLock::new();
        APP_ID.get_or_init(|| {
            let identifier = app.config().identifier.clone();
            let exe_dir = tauri::utils::platform::current_exe()
                .ok()
                .and_then(|exe| exe.parent().map(Path::to_path_buf));
            let dev_dir = exe_dir.filter(|dir| {
                let dir = dir.display().to_string();
                dir.ends_with(&format!("{SEP}target{SEP}debug")) || dir.ends_with(&format!("{SEP}target{SEP}release"))
            });
            match dev_dir {
                None => identifier,
                Some(dir) => {
                    let id = format!("{identifier}.dev");
                    let icon = dir.join("..").join("..").join("icons").join("128x128.png");
                    let icon = icon.canonicalize().map(|p| p.display().to_string()).unwrap_or_default();
                    register_app_id(&id, "NanChat (dev)", icon.trim_start_matches(r"\\?\"));
                    id
                }
            }
        })
    }

    fn register_app_id(id: &str, display_name: &str, icon: &str) {
        unsafe {
            let mut key = HKEY::default();
            let path = HSTRING::from(format!(r"Software\Classes\AppUserModelId\{id}"));
            if RegCreateKeyExW(HKEY_CURRENT_USER, &path, None, PCWSTR::null(), REG_OPTION_NON_VOLATILE, KEY_SET_VALUE, None, &mut key, None)
                .is_err()
            {
                return;
            }
            let set = |name: &str, value: &str| {
                let data: Vec<u8> = value.encode_utf16().chain(Some(0)).flat_map(u16::to_le_bytes).collect();
                let _ = RegSetValueExW(key, &HSTRING::from(name), None, REG_SZ, Some(&data));
            };
            set("DisplayName", display_name);
            if !icon.is_empty() {
                set("IconUri", icon);
            }
            let _ = RegCloseKey(key);
        }
    }

    pub fn show_toast(
        app: &AppHandle,
        title: &str,
        body: &str,
        chat_id: Option<String>,
        silent: bool,
    ) -> windows::core::Result<()> {
        // Notification.IM: Windows' "Instant Message Notification" sound (softer than the default),
        // which follows the user's sound scheme
        let audio = if silent { r#"<audio silent="true"/>"# } else { r#"<audio src="ms-winsoundevent:Notification.IM"/>"# };
        let xml = format!(
            r#"<toast><visual><binding template="ToastGeneric"><text>{}</text><text>{}</text></binding></visual>{audio}</toast>"#,
            escape(title),
            escape(body)
        );
        let document = XmlDocument::new()?;
        document.LoadXml(&HSTRING::from(xml))?;
        let toast = ToastNotification::CreateToastNotification(&document)?;

        let handler_app = app.clone();
        toast.Activated(&TypedEventHandler::<ToastNotification, IInspectable>::new(move |_, _| {
            // raised on a background thread: the window is handled on the main thread
            let app = handler_app.clone();
            let chat_id = chat_id.clone();
            let _ = handler_app.run_on_main_thread(move || {
                super::focus_main_window(&app);
                if let Some(chat_id) = chat_id {
                    let _ = app.emit_to("main", "notification-clicked", chat_id);
                }
            });
            Ok(())
        }))?;

        ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(app_id(app)))?.Show(&toast)?;
        let mut toasts = TOASTS.lock().unwrap_or_else(|e| e.into_inner());
        toasts.push_back(toast);
        while toasts.len() > KEEP_TOASTS {
            toasts.pop_front();
        }
        Ok(())
    }
}

/// Taskbar right-click menu (jump list) of the app: one task to turn notifications off / on.
/// Rebuilt with the right label each time the setting changes.
#[cfg(windows)]
mod jump_list {
    use windows::core::{Interface, HSTRING};
    use windows::Win32::Storage::EnhancedStorage::PKEY_Title;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED};
    use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
    use windows::Win32::UI::Shell::Common::{IObjectArray, IObjectCollection};
    use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
    use windows::Win32::UI::Shell::{DestinationList, EnumerableObjectCollection, ICustomDestinationList, IShellLinkW, ShellLink};

    pub fn update(disabled: bool) -> windows::core::Result<()> {
        let label = if disabled { "Turn on notifications" } else { "Turn off notifications" };
        let exe = std::env::current_exe()?;
        let exe = HSTRING::from(exe.as_os_str());
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED); // already initialized on the main thread
            let list: ICustomDestinationList = CoCreateInstance(&DestinationList, None, CLSCTX_INPROC_SERVER)?;
            let mut min_slots = 0u32;
            let _removed: IObjectArray = list.BeginList(&mut min_slots)?;

            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
            link.SetPath(&exe)?;
            link.SetArguments(&HSTRING::from(super::TOGGLE_ARG))?;
            link.SetIconLocation(&exe, 0)?;
            link.SetDescription(&HSTRING::from(label))?;
            let properties: IPropertyStore = link.cast()?;
            properties.SetValue(&PKEY_Title, &PROPVARIANT::from(label))?;
            properties.Commit()?;

            let tasks: IObjectCollection = CoCreateInstance(&EnumerableObjectCollection, None, CLSCTX_INPROC_SERVER)?;
            tasks.AddObject(&link)?;
            list.AddUserTasks(&tasks.cast::<IObjectArray>()?)?;
            list.CommitList()
        }
    }
}
