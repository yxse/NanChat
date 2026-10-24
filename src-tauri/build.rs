fn main() {
    // Declaring the app commands here makes Tauri enforce the ACL on them.
    // Without an app manifest, app commands bypass capabilities entirely and
    // are invocable from any webview with IPC access (incl. remote pages in
    // the in-app browser). Grant them explicitly in capabilities/main.json.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "save_secret",
            "get_secret",
            "delete_secret",
            "open_browser_window",
        ])),
    )
    .expect("failed to run tauri-build");
}
