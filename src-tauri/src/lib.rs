use tauri_plugin_deep_link::DeepLinkExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.deep_link().register("nano")?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}