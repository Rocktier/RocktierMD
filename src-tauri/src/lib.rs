use tauri::{Emitter, WindowEvent};

/// Destroys the main window without re-triggering CloseRequested.
/// The frontend calls this after the user confirms discarding changes.
#[tauri::command]
fn force_close(window: tauri::Window) {
    let _ = window.destroy();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![force_close])
        .on_window_event(|window, event| {
            // Hand the close decision to the frontend, which checks for
            // unsaved changes before destroying the window.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.emit("app-close-requested", ());
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
