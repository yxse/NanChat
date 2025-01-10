use tauri_plugin_deep_link::DeepLinkExt;
use tauri::{AppHandle, Manager};
use keyring::{error::Error as KeyringError, Entry as KeyringEntry};
use serde::{Deserialize, Serialize};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let _ = app.get_webview_window("main")
                       .expect("no main window")
                       .set_focus();
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.deep_link().register("nan")?;
            app.deep_link().register("nanauth")?;
            app.deep_link().register("nano")?;
            app.deep_link().register("ban")?;
            app.deep_link().register("xdg")?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_secret, get_secret])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
