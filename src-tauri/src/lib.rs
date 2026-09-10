use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, WindowEvent};

/// 前端完成初始化（关窗确认监听器已注册）后置位。
/// 之前无条件拦截关窗：若前端尚未就绪或 JS 已崩溃，窗口将永远关不掉。
pub struct Ready(pub AtomicBool);

/// Destroys the main window without re-triggering CloseRequested.
/// The frontend calls this after the user confirms discarding changes.
#[tauri::command]
fn force_close(window: tauri::Window) {
    let _ = window.destroy();
}

/// 前端在注册完 app-close-requested 监听后调用，启用“拦截关窗”流程。
#[tauri::command]
fn mark_ready(state: tauri::State<Ready>) {
    state.0.store(true, Ordering::Release);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            app.manage(Ready(AtomicBool::new(false)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![force_close, mark_ready])
        .on_window_event(|window, event| {
            // Hand the close decision to the frontend, which checks for
            // unsaved changes before destroying the window.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let ready = window
                    .try_state::<Ready>()
                    .map(|r| r.0.load(Ordering::Acquire))
                    .unwrap_or(false);
                if !ready {
                    return; // 前端未就绪：走默认关闭，避免“僵尸窗口”
                }
                let _ = window.emit("app-close-requested", ());
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
