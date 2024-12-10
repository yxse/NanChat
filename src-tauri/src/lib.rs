use tauri_plugin_deep_link::DeepLinkExt;

use keyring::{
    Entry as KeyringEntry, 
    error::Error as KeyringError
};
use serde::{Serialize, Deserialize};

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
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.deep_link().register("nano")?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_secret,
            get_secret
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}