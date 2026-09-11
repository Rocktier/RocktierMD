use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use serde::Serialize;
use tauri::{Emitter, Manager, WindowEvent};

/// 前端完成初始化（关窗确认监听器已注册）后置位。
/// 之前无条件拦截关窗：若前端尚未就绪或 JS 已崩溃，窗口将永远关不掉。
pub struct Ready(pub AtomicBool);

/// 关窗看门狗状态（复审 F5）：就绪后若 JS 崩溃 / 事件循环卡死，
/// 监听器已死但 prevent_close 依旧生效 → 僵尸窗口回归。
/// 前端收到 app-close-requested 后立即调用 close_ack 证明自己存活；
/// 看门狗只在"已请求但 10s 内无 ack"时才强制销毁窗口。
pub struct CloseWatch {
    pub requested: AtomicU64,
    pub acked: AtomicU64,
}

/// 启动时要打开的文档路径，由操作系统传入：
/// - Windows / Linux：文件关联注册的打开命令是 `"app.exe" "%1"`，路径在 argv 里；
/// - macOS / iOS：走 `RunEvent::Opened` 事件（见 `run()`）。冷启动时该事件可能早于
///   前端挂载，所以先缓冲在这里，前端挂载后再用 `initial_file` 拉取。
pub struct InitialFile(pub Mutex<Option<String>>);

/// 与前端 `MARKDOWN_EXTS` 保持一致。只关联 Markdown 家族：把 txt/text 也抢过来
/// 会顶掉记事本等既有关联，且资源管理器「类型」列会被污染成 Markdown。
const MARKDOWN_EXTS: [&str; 8] = [
    "md", "markdown", "mdown", "mkd", "mkdn", "mdwn", "mdtxt", "mdtext",
];

fn is_markdown_path(path: &std::path::Path) -> bool {
    if !path.is_file() {
        return false;
    }
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => MARKDOWN_EXTS.contains(&ext.to_ascii_lowercase().as_str()),
        None => false,
    }
}

/// 取命令行里第一个真实存在的 Markdown 文件。
/// 更新器开关等其它参数会被 is_markdown_path 自然过滤掉。
fn file_from_args() -> Option<String> {
    std::env::args_os()
        .skip(1)
        .map(std::path::PathBuf::from)
        .find(|p| is_markdown_path(p))
        .map(|p| p.to_string_lossy().into_owned())
}

/// 前端挂载后询问「启动时是否带了文档」。
/// 刻意只 clone 不 take：React StrictMode 在 dev 下会把 effect 跑两遍，
/// take 会让第二次调用拿到 None，启动文件就被丢掉了。
#[tauri::command]
fn initial_file(state: tauri::State<InitialFile>) -> Option<String> {
    state.0.lock().ok().and_then(|slot| slot.clone())
}

/// Destroys the main window without re-triggering CloseRequested.
/// The frontend calls this after the user confirms discarding changes.
#[tauri::command]
fn force_close(window: tauri::Window) {
    let _ = window.destroy();
}

/// 前端在注册完 app-close-requested 监听后调用，启用"拦截关窗"流程。
#[tauri::command]
fn mark_ready(state: tauri::State<Ready>) {
    state.0.store(true, Ordering::Release);
}

/// 前端收到 app-close-requested 后立刻调用：证明 JS 事件循环存活。
/// 用户此时可能正停在"未保存更改"确认弹窗上思考，看门狗不得强杀。
#[tauri::command]
fn close_ack(state: tauri::State<CloseWatch>) {
    let req = state.requested.load(Ordering::Acquire);
    state.acked.store(req, Ordering::Release);
}

/// Returns the current git branch for a directory, or null if not a repo.
/// Lightweight: runs `git rev-parse --abbrev-ref HEAD` without extra deps.
#[tauri::command]
fn git_branch(dir: String) -> Option<String> {
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&dir)
        .output()
        .ok()?;
    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

/// 短 hash：加入恢复文件名，避免 safe_name 把 `/ \ :` 替换为 `_` 后
/// `/a/b.md` 与 `x/a_b.md` 落到同一个文件互相覆盖（复审 F8）。
fn short_hash(s: &str) -> String {
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    format!("{:08x}", h.finish() as u32)
}

#[cfg(desktop)]
fn recovery_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("recovery");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn recovery_file_name(path: &str) -> String {
    let safe_name = path.replace(|c: char| c == '/' || c == '\\' || c == ':', "_");
    format!("{}-{}.json", safe_name, short_hash(path))
}

#[derive(Serialize)]
struct RecoveryEntry {
    path: String,
    content: String,
    modified_ms: u64,
}

/// Writes a recovery file (JSON, embedding the original path) to the app's
/// data directory for crash recovery.
#[tauri::command]
#[cfg(desktop)]
fn save_recovery(app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    let dir = recovery_dir(&app)?;
    let file = dir.join(recovery_file_name(&path));
    let payload = serde_json::json!({ "path": path, "content": content });
    std::fs::write(&file, payload.to_string()).map_err(|e| e.to_string())?;
    Ok(())
}

/// Lists all recovery drafts, newest first. Frontend offers restore on launch.
#[tauri::command]
#[cfg(desktop)]
fn list_recovery(app: tauri::AppHandle) -> Result<Vec<RecoveryEntry>, String> {
    let dir = recovery_dir(&app)?;
    let mut out: Vec<RecoveryEntry> = Vec::new();
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return Ok(out),
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(raw) = std::fs::read_to_string(&p) else {
            continue;
        };
        let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else {
            continue;
        };
        let (Some(path), Some(content)) = (v["path"].as_str(), v["content"].as_str()) else {
            continue;
        };
        let modified_ms = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        out.push(RecoveryEntry {
            path: path.to_string(),
            content: content.to_string(),
            modified_ms,
        });
    }
    out.sort_by_key(|e| std::cmp::Reverse(e.modified_ms));
    Ok(out)
}

/// Deletes the recovery draft for a path (after restore or explicit discard).
#[tauri::command]
#[cfg(desktop)]
fn clear_recovery(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dir = recovery_dir(&app)?;
    let file = dir.join(recovery_file_name(&path));
    if file.exists() {
        std::fs::remove_file(&file).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            app.manage(Ready(AtomicBool::new(false)));
            app.manage(CloseWatch {
                requested: AtomicU64::new(0),
                acked: AtomicU64::new(0),
            });
            // 双击关联文件启动时（Windows/Linux）路径在 argv 里，先缓冲起来。
            app.manage(InitialFile(Mutex::new(file_from_args())));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            force_close,
            mark_ready,
            close_ack,
            git_branch,
            save_recovery,
            list_recovery,
            clear_recovery,
            initial_file
        ])
        .on_window_event(|window, event| {
            // Hand the close decision to the frontend, which checks for
            // unsaved changes before destroying the window.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let ready = window
                    .try_state::<Ready>()
                    .map(|r| r.0.load(Ordering::Acquire))
                    .unwrap_or(false);
                if !ready {
                    return; // 前端未就绪：走默认关闭，避免"僵尸窗口"
                }
                let Some(watch) = window.try_state::<CloseWatch>() else {
                    let _ = window.emit("app-close-requested", ());
                    api.prevent_close();
                    return;
                };
                let gen = watch.requested.fetch_add(1, Ordering::AcqRel) + 1;
                let _ = window.emit("app-close-requested", ());
                api.prevent_close();
                // 看门狗（复审 F5）：emit 后启动 10s 定时器。
                //  - 前端存活 → 立即 close_ack（acked >= gen）→ 不强杀，
                //    用户可以从容处理确认弹窗；
                //  - JS 崩溃 / 事件循环卡死 → 无 ack → 10s 后强制销毁，
                //    "理论上关不掉"变成"最多卡 10 秒"。
                //  - 期间若产生新一轮关窗请求（requested != gen），本轮退避，
                //    由新一轮看门狗接管。
                let w = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(10));
                    let Some(watch) = w.try_state::<CloseWatch>() else {
                        return;
                    };
                    if watch.acked.load(Ordering::Acquire) < gen
                        && watch.requested.load(Ordering::Acquire) == gen
                    {
                        let _ = w.destroy();
                    }
                });
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {
        // macOS / iOS 的文件关联不是命令行参数，而是一个事件（Windows 见 file_from_args）。
        // 两种时序都要兜住：冷启动时事件可能早于前端挂载 —— 所以写进 InitialFile，
        // 前端挂载后经 initial_file 拉取；也可能晚于挂载 —— 所以同时 emit 出去。
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = _event {
            for url in urls {
                let Ok(path) = url.to_file_path() else { continue };
                let Some(path) = path.to_str() else { continue };
                if !is_markdown_path(std::path::Path::new(path)) {
                    continue;
                }
                if let Some(state) = _app_handle.try_state::<InitialFile>() {
                    if let Ok(mut slot) = state.0.lock() {
                        *slot = Some(path.to_string());
                    }
                }
                let _ = _app_handle.emit("open-file", path);
                break;
            }
        }
    });
}
