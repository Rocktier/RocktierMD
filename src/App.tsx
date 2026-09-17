import { useState, useCallback, useEffect, useDeferredValue, useMemo, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "./components/Toolbar";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
import { Sidebar } from "./components/Sidebar";
import { FindReplace } from "./components/FindReplace";
import { StatusBar } from "./components/StatusBar";
import { useTheme, toggleTheme } from "./hooks/useTheme";
import { useScrollSync } from "./hooks/useScrollSync";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  parseDocument, extractHeadings, readStats, getTaskLines, parseFrontmatter,
  type Frontmatter,
} from "./services/markdown";
import {
  openFile, saveFile, saveFileAs, confirmDialog, normalizeEol, applyEol, type Eol,
} from "./services/file";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { WELCOME_DOCUMENT, type MarkdownDocument, type ViewMode } from "./types/index";
import { t, useUiLang } from "./i18n";

const LAST_PATH_KEY = "rocktier-md-last-path";
const RECENT_KEY = "rocktier-md-recent";
const RECENT_MAX = 5;

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MARKDOWN_EXTS = ["md", "markdown", "mdown", "mkd", "txt", "text"];

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() || "Untitled";
}

// Resolve a relative markdown link against the current document's directory.
// Handles ./ and ../ segments; accepts both POSIX and Windows separators
// and drive letters — returns an absolute path usable by the fs plugin.
function resolvePath(base: string, rel: string): string {
  const relIsAbs = /^[/\\]/.test(rel) || /^[A-Za-z]:[\\/]/.test(rel);
  const combined = relIsAbs ? rel : base + rel;
  const parts = combined.split(/[\\/]/);
  // Windows 盘符（"C:"）保留在结果开头，其余段做 .. / . 归一化
  const drive = /^[A-Za-z]:$/.test(parts[0]) ? parts.shift() : null;
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  const joined = out.join("/");
  return drive ? `${drive}/${joined}` : `/${joined}`;
}

export default function App() {
  useTheme();
  // 订阅语言变化：App 内的 t()（toast、frontmatter 面板、确认弹窗）
  // 在切换语言后立即重渲染，避免半新半旧（复审 F9）。
  const lang = useUiLang();

  const [doc, setDoc] = useState<MarkdownDocument>({
    path: null,
    content: WELCOME_DOCUMENT,
    modified: false,
  });

  const [view, setView] = useState<ViewMode>("split");
  const [sidebar, setSidebar] = useState(false);
  const [toast, setToast] = useState("");
  const [frontmatterOpen, setFrontmatterOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [gitBranch, setGitBranch] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const toastRef = useRef(0);
  const checkingRef = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const docRef = useRef(doc);
  const lastSavedContentRef = useRef(doc.content);
  // 新建文档在首次保存前的恢复 key（合成路径，磁盘上不存在）
  const UNTITLED_KEY = "__untitled__";
  // 基线所属的文件路径：文档切换时基线必须跟着换（外部修改检测依赖它）
  const lastPathRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 文档原始换行风格：读取时记录、保存时还原。textarea 会把 CRLF 归一成 LF，
  // 不还原就会在首次编辑后把整份文件的换行改写。
  const eolRef = useRef<Eol>("\n");

  // 草稿是"尚未落盘的内容"的唯一副本，只在这些时刻清除：
  // 内容已成功写盘、或用户明确选择丢弃/不恢复。
  const clearRecovery = useCallback((key: string | null | undefined) => {
    if (!key || !isTauri) return;
    invoke("clear_recovery", { path: key }).catch(() => {});
  }, []);

  // 切换文档前清掉上一个文档的草稿（调用点都在"用户已确认丢弃"之后）
  const clearPreviousDrafts = useCallback(() => {
    clearRecovery(docRef.current.path);
    if (docRef.current.modified || !docRef.current.path) clearRecovery(UNTITLED_KEY);
  }, [clearRecovery, UNTITLED_KEY]);
  const externalCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { onEditorScroll, onPreviewScroll } = useScrollSync(editorRef, previewRef);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  // Typing must never wait for parsing: preview renders from a deferred
  // snapshot, so large documents stay responsive while typing.
  const deferredContent = useDeferredValue(doc.content);
  const parsed = useMemo(() => parseDocument(deferredContent), [deferredContent]);
  const html = parsed.html;
  const headings = useMemo(() => extractHeadings(deferredContent), [deferredContent]);
  const taskLines = useMemo(() => getTaskLines(deferredContent), [deferredContent]);
  const stats = useMemo(() => readStats(deferredContent), [deferredContent]);
  const frontmatterData = useMemo<Frontmatter | null>(() =>
    parsed.frontmatter ? parseFrontmatter(parsed.frontmatter) : null, [parsed.frontmatter]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setToast(""), 2000);
  }, []);

  const onChange = useCallback((content: string) => {
    setDoc((d) => ({ ...d, content, modified: true }));
  }, []);

  // Guard: confirm before discarding unsaved changes (new / open / quit)
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!docRef.current.modified) return true;
    return confirmDialog(t("confirm.discard"));
  }, []);

  // Native close button: Rust blocks the close until the frontend is ready,
  // then hands the decision to the frontend (unsaved-changes check).
  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    (async () => {
      const fn = await getCurrentWindow().listen<null>("app-close-requested", async () => {
        // 立即向 Rust 报告"事件循环存活"，阻止 10s 看门狗强杀（复审 F5）。
        // 用户可能正停在确认弹窗上，不能被看门狗误伤。
        invoke("close_ack").catch(() => {});
        if (!(await confirmDiscard())) return;
        try {
          await invoke("force_close");
        } catch {
          // window already gone
        }
      });
      if (disposed) {
        fn();
        return;
      }
      unlisten = fn;
      // 前端就绪后才启用“拦截关窗”。若 JS 尚未加载完/已崩溃，
      // Rust 侧直接放行默认关闭行为，避免出现永远关不掉的窗口。
      await invoke("mark_ready").catch(() => {});
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [confirmDiscard]);

  const rememberPath = useCallback((path: string | null) => {
    try {
      if (path) {
        localStorage.setItem(LAST_PATH_KEY, path);
        // 最近打开列表（本轮 U1）：去重、最新在前、封顶 5 条
        const list: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
        const next = [path, ...list.filter((p) => p !== path)].slice(0, RECENT_MAX);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        setRecent(next);
      } else {
        localStorage.removeItem(LAST_PATH_KEY);
      }
    } catch {
      // storage full or unavailable — non-fatal
    }
  }, []);

  // Load recent list on mount
  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch {
      // corrupted entry — start empty
    }
  }, []);

  // Restore last-opened document on launch (zero-click resume), then scan
  // the recovery dir for unsaved drafts (复审 F8：恢复文件之前只写不读)。
  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    (async () => {
      // 0) 双击关联文件启动时，OS 传来的路径优先级最高
      //    （Windows 走 argv，macOS 走 RunEvent::Opened，两边都由 Rust 归一化）
      let launchedWith = "";
      try {
        launchedWith = (await invoke<string | null>("initial_file")) || "";
      } catch {
        // 拉不到就当没有，继续走零点击恢复
      }

      // 1) 只有双击 .md 文件启动时才打开对应文档；普通启动一律是新的空白页
      //    （家族启动状态策略：启动不静默恢复上次文档，用户从侧栏"最近打开"自己点）。
      let restored: MarkdownDocument | null = null;
      const candidates = launchedWith ? [launchedWith] : [];
      for (const raw of candidates) {
        if (!raw) continue;
        try {
          if (await exists(raw)) {
            const { content, eol } = normalizeEol(await readTextFile(raw));
            if (!cancelled) {
              eolRef.current = eol;
              restored = { path: raw, content, modified: false };
            }
            break;
          }
        } catch {
          // file moved or unreadable — try the next candidate
        }
      }

      // eslint-disable-next-line no-debugger
      // 2) 再扫描恢复草稿：优先匹配当前文档，否则取最近一份
      try {
        const entries = await invoke<
          Array<{ path: string; content: string; modified_ms: number }>
        >("list_recovery");
        // 只恢复「当前文档」的草稿，外加普通启动时的「未命名草稿」。
        // 前者避免拿别的文件的草稿来问（点"是"就把 B 灌进 A）；后者是唯一
        // 没有任何磁盘副本的一份——不主动问，用户崩溃后重开就等于全丢。
        const opened = restored; // 闭包内需要非空快照（let 的收窄进不了回调）
        const draft = opened
          ? entries.find((e) => e.path === opened.path)
          : entries.find((e) => e.path === UNTITLED_KEY);
        if (draft && !cancelled) {
          const untitled = draft.path === UNTITLED_KEY;
          if (!untitled && restored && restored.path === draft.path && restored.content === draft.content) {
            // 草稿与磁盘内容一致（上次正常保存过），直接清掉
            await invoke("clear_recovery", { path: draft.path }).catch(() => {});
          } else if (await confirmDialog(t(untitled ? "confirm.recoverUntitled" : "confirm.recover"))) {
            if (!cancelled) {
              restored = {
                path: untitled ? null : draft.path,
                content: draft.content,
                modified: true,
              };
            }
            // 注意：接受恢复时不清草稿——用户可能看完就关掉窗口，
            // 那时草稿是这份内容的唯一副本，要留到真正保存成功再清。
          } else {
            // 用户拒绝恢复 → 清掉这份草稿，下次不再打扰。
            // 这里用 draft.path（而非 restored?.path）：后者为 null 时旧代码永远清不掉，
            // 于是同一个恢复提示每次启动都会弹一遍。
            await invoke("clear_recovery", { path: draft.path }).catch(() => {});
          }
        }
      } catch {
        // recovery scan is best-effort
      }

      if (!cancelled && restored) {
        setDoc(restored);
        if (restored.path) rememberPath(restored.path);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rememberPath]);

  // Toggle task checkbox: use 1-based source line number to avoid index drift.
  const toggleTask = useCallback((lineNumber: number, checked: boolean) => {
    const el = editorRef.current;
    const start = el?.selectionStart ?? -1;
    const end = el?.selectionEnd ?? -1;
    setDoc((d) => {
      const lines = d.content.split("\n");
      const i = lineNumber - 1;
      // 与 markdown.ts getTaskLines 同源：接受引用块前缀（> - [ ] 待办），
      // 否则引用块内渲染出的 checkbox 点击无效（复审 F4）。
      if (i >= 0 && i < lines.length && /^\s*(>\s*)*[-*+]\s+\[[ xX]\]/.test(lines[i])) {
        const next = lines[i].replace(/(\[)[ xX](\])/, `$1${checked ? "x" : " "}$2`);
        if (next === lines[i]) return d;
        lines[i] = next;
        return { ...d, content: lines.join("\n"), modified: true };
      }
      return d;
    });
    // The textarea is controlled: React resetting value moves the caret to
    // the end, so restore the selection after the re-render commits.
    if (el && start >= 0 && document.activeElement === el) {
      requestAnimationFrame(() => {
        try {
          el.setSelectionRange(start, end);
        } catch {
          // element detached
        }
      });
    }
  }, []);

  const doOpen = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    const r = await openFile();
    if (r) {
      clearPreviousDrafts();
      eolRef.current = r.eol;
      lastSavedContentRef.current = r.content;
      lastPathRef.current = r.path;
      setDoc({ path: r.path, content: r.content, modified: false });
      rememberPath(r.path);
      showToast(t("toast.fileOpened"));
    }
  }, [confirmDiscard, showToast, rememberPath, clearPreviousDrafts]);

  const doSave = useCallback(async () => {
    const { path, content } = docRef.current;
    // 写盘用文档原本的换行风格（内存里统一是 LF）
    const payload = applyEol(content, eolRef.current);
    try {
      if (!path) {
        const p = await saveFileAs(payload);
        if (!p) return;
        // 与主分支保持一致：另存成功同样是"已真正保存到磁盘"，
        // 同步基线，缩小外部变更检测的空窗（复审 F11）。
        lastSavedContentRef.current = content;
        lastPathRef.current = p;
        // 内容已落盘，草稿（这份内容的唯一旧副本）可以清了
        clearRecovery(UNTITLED_KEY);
        setDoc((d) => (d.content === content ? { ...d, path: p, modified: false } : { ...d, path: p }));
        rememberPath(p);
      } else {
        await saveFile(path, payload);
        lastSavedContentRef.current = content;
        clearRecovery(path);
        // 等待写盘期间用户可能又输入了：只有内容未变才敢标记为已保存
        setDoc((d) => (d.content === content ? { ...d, modified: false } : d));
      }
      showToast(t("toast.saved"));
    } catch {
      showToast(t("toast.saveFailed"));
    }
  }, [showToast, rememberPath, clearRecovery, UNTITLED_KEY]);

  const doSaveAs = useCallback(async () => {
    const content = docRef.current.content;
    try {
      const name = docRef.current.path ? baseName(docRef.current.path) : undefined;
      const p = await saveFileAs(applyEol(content, eolRef.current), name);
      if (p) {
        // 与 doSave 保持一致：另存也是一次真正的落盘，基线要跟着走
        lastSavedContentRef.current = content;
        lastPathRef.current = p;
        clearRecovery(UNTITLED_KEY);
        clearRecovery(docRef.current.path);
        setDoc((d) => (d.content === content ? { ...d, path: p, modified: false } : { ...d, path: p }));
        rememberPath(p);
        showToast(t("toast.savedAs"));
      }
    } catch {
      showToast(t("toast.saveFailed"));
    }
  }, [showToast, rememberPath, clearRecovery, UNTITLED_KEY]);

  const doNew = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    clearPreviousDrafts();
    eolRef.current = "\n";
    setDoc({ path: null, content: "", modified: false });
    showToast(t("toast.newDoc"));
  }, [confirmDiscard, showToast, clearPreviousDrafts]);

  // 原生菜单跟随 UI 语言重建（macOS 顶栏的 文件/编辑/显示/窗口，本轮问题 2）
  useEffect(() => {
    if (!isTauri) return;
    invoke("build_menu", { lang }).catch(() => {});
  }, [lang]);

  const cycleView = useCallback(() => {
    setView((v) => (v === "split" ? "editor" : v === "editor" ? "preview" : "split"));
  }, []);

  // PDF export prints the preview pane. If the preview is hidden, mount it
  // first and restore the previous view when printing finishes.
  // 注意：必须走 Tauri 的 print()（IPC → wry 的 printOperationWithPrintInfo，
  // 弹系统打印面板，可选"存储为 PDF"）。WKWebView 对 JS 的 window.print()
  // 是静默 no-op，这就是此前按钮毫无反应的原因。
  // 原生打印面板是模态的：await 返回即对话框已关闭，直接恢复视图，
  // 不再需要 afterprint / 兜底定时器（复审 F7 的两件套一并作废）。
  const doExportPdf = useCallback(async () => {
    const wasEditor = view === "editor";
    if (wasEditor) setView("preview");
    // 等一帧让预览挂载完成，再交给系统打印
    await new Promise((r) => setTimeout(r, 150));
    try {
      await invoke("print_doc");
    } catch {
      // printing unavailable — stay on current view
    }
    if (wasEditor) setView("editor");
  }, [view]);

  // 菜单事件 → 现有动作链（未保存守卫 / toast 都在前端，这里只做转发）
  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .listen<string>("menu-action", (e) => {
        switch (e.payload) {
          case "new": doNew(); break;
          case "open": doOpen(); break;
          case "save": doSave(); break;
          case "save-as": doSaveAs(); break;
          case "find": setFindReplaceOpen((v) => !v); break;
          case "export-pdf": doExportPdf(); break;
          case "toggle-sidebar": setSidebar((v) => !v); break;
          case "toggle-theme": toggleTheme(); break;
          case "website": void invoke('open_url', { url: 'https://rocktier.com/' }).catch(() => {}); break;
          case "feedback": void invoke('open_url', { url: 'mailto:hello@rocktier.com' }).catch(() => {}); break;
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [doNew, doOpen, doSave, doSaveAs, doExportPdf]);

  const shortcuts = useMemo(
    () => ({
      onSave: doSave,
      onSaveAs: doSaveAs,
      onNew: doNew,
      onOpen: doOpen,
      onToggleSidebar: () => setSidebar((v) => !v),
      onFindReplace: () => setFindReplaceOpen((v) => !v),
      onExportPdf: doExportPdf,
    }),
    [doSave, doSaveAs, doNew, doOpen, doExportPdf]
  );
  useKeyboardShortcuts(shortcuts);

  const displayName = doc.path ? baseName(doc.path) : t("doc.untitled");
  const hasFrontmatter = frontmatterData !== null;

  // 在桌面端通过 Tauri 拖放事件 / 浏览器 dev 通过 HTML5 拖放打开文件。
  // 注意：打包版（dragDropEnabled 默认 true）下 HTML5 drop 不会触发，
  // 必须走 onDragDropEvent —— 此前只实现了 HTML5 路径，导致发布版拖拽失效。
  const openMarkdownPath = useCallback(async (path: string): Promise<boolean> => {
    const ext = path.split(".").pop()?.toLowerCase();
    if (!ext || !MARKDOWN_EXTS.includes(ext)) {
      showToast(t("toast.unsupportedType"));
      return false;
    }
    if (!(await confirmDiscard())) return false;
    try {
      if (!(await exists(path))) {
        showToast(t("toast.fileNotExists"));
        return false;
      }
      const { content, eol } = normalizeEol(await readTextFile(path));
      clearPreviousDrafts();
      eolRef.current = eol;
      lastSavedContentRef.current = content;
      lastPathRef.current = path;
      setDoc({ path, content, modified: false });
      rememberPath(path);
      showToast(t("toast.fileOpened"));
      return true;
    } catch {
      showToast(t("toast.cannotReadFile"));
      return false;
    }
  }, [confirmDiscard, rememberPath, showToast, clearPreviousDrafts]);

  // Drag-and-drop file open (browser dev fallback; desktop uses onDragDropEvent)
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !MARKDOWN_EXTS.includes(ext)) {
      showToast(t("toast.unsupportedType"));
      return;
    }
    if (!(await confirmDiscard())) return;
    try {
      const { content, eol } = normalizeEol(await (file as any).text());
      eolRef.current = eol;
      setDoc({ path: (file as any).path ?? null, content, modified: false });
      if ((file as any).path) rememberPath((file as any).path);
      showToast(t("toast.fileOpened"));
    } catch {
      showToast(t("toast.cannotReadFile"));
    }
  }, [confirmDiscard, rememberPath, showToast]);

  // Desktop drag & drop (Tauri v2 native event; works in the packaged app)
  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onDragDropEvent(async (event) => {
        const payload = (event as { payload?: { type?: string; paths?: string[] } }).payload;
        if (payload?.type !== "drop") return;
        const path = payload.paths?.[0];
        if (!path) return;
        if (disposed) return;
        await openMarkdownPath(path);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openMarkdownPath]);

  // 应用已在运行时再次双击关联文件：macOS 由 Rust 的 RunEvent::Opened 转成这个事件。
  // Windows 是另起一个进程，路径走上面的启动分支，不会到这里。
  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .listen<string>("open-file", async (event) => {
        const path = event.payload;
        // 冷启动竞态：事件晚于 initial_file 到达时，文档已经是它了，别重复弹 toast
        if (!path || path === docRef.current.path) return;
        await openMarkdownPath(path);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openMarkdownPath]);

  // ── Auto-save: debounced write to recovery file every 5s of inactivity ──
  const autoSave = useCallback(async (path: string | null, content: string) => {
    // 新建文档还没有路径，用合成 key 兜住——崩溃恢复最该保住的就是从未落盘的文档
    if (!content.trim()) return;
    if (!path) path = UNTITLED_KEY;
    if (!isTauri) return;
    try {
      await invoke("save_recovery", { path, content });
      // 注意：这里绝不能更新 lastSavedContentRef —— 它表示"已真正保存到
      // 目标文件"的基线，供 checkExternalChange 对比磁盘。恢复文件写入
      // 与保存是两个概念，污染基线会导致磁盘旧内容被误判为"外部修改"，
      // 用户确认重载后未保存内容直接丢失（见复审 F1）。
    } catch {
      // recovery write is best-effort — silent failure
    }
  }, []);

  // Kick off auto-save after 5s of inactivity
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (!doc.modified) return;
    autoSaveTimerRef.current = setTimeout(() => {
      autoSave(doc.path, doc.content);
    }, 5000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [doc.content, doc.path, doc.modified, autoSave]);

  // ── External change detection: poll file every 3s ──
  // In-flight guard: the async body can block on a native confirm dialog;
  // without the guard, overlapping ticks would stack dialogs (复审 F2).
  const checkExternalChange = useCallback(async () => {
    if (checkingRef.current) return;
    const { path } = docRef.current;
    if (!path || !isTauri) return;
    checkingRef.current = true;
    try {
      if (!(await exists(path))) return;
      // 先归一化再比较：基线是 LF，CRLF 文件不归一会被每轮轮询误判成"外部修改"
      const { content: diskContent, eol } = normalizeEol(await readTextFile(path));
      // 文档刚被切换/载入过：基线还停留在上一个文件，先以磁盘内容重建基线再比较。
      if (lastPathRef.current !== path) {
        lastPathRef.current = path;
        lastSavedContentRef.current = diskContent;
        return;
      }
      if (diskContent === lastSavedContentRef.current) return;
      if (diskContent === docRef.current.content) {
        lastSavedContentRef.current = diskContent;
        return;
      }
      // File changed on disk and differs from current doc
      const choice = await confirmDialog(t("confirm.externalChange"));
      if (choice) {
        eolRef.current = eol;
        setDoc({ path, content: diskContent, modified: false });
        lastSavedContentRef.current = diskContent;
        showToast(t("toast.reloaded"));
      } else {
        lastSavedContentRef.current = diskContent; // user dismissed — don't ask again
      }
    } catch {
      // file unreadable — ignore
    } finally {
      checkingRef.current = false;
    }
  }, [showToast]);

  useEffect(() => {
    if (!isTauri) return;
    externalCheckRef.current = setInterval(checkExternalChange, 3000);
    return () => {
      if (externalCheckRef.current) clearInterval(externalCheckRef.current);
    };
  }, [checkExternalChange]);

  // ── Detect git branch（复审 F15：按 dir 缓存，避免每次切文档 spawn 进程）──
  const gitBranchCacheRef = useRef(new Map<string, string | null>());
  useEffect(() => {
    if (!isTauri || !doc.path) {
      setGitBranch("");
      return;
    }
    let cancelled = false;
    const currentPath = doc.path;
    (async () => {
      const dir = currentPath.replace(/[^/\\]+$/, "");
      const cache = gitBranchCacheRef.current;
      if (cache.has(dir)) {
        setGitBranch(cache.get(dir) || "");
        return;
      }
      try {
        const branch = await invoke<string | null>("git_branch", { dir });
        cache.set(dir, branch);
        if (!cancelled) setGitBranch(branch || "");
      } catch {
        cache.set(dir, null);
        if (!cancelled) setGitBranch("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.path]);

  // ── Track cursor line/column ──
  const onCursorMove = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const textBefore = el.value.substring(0, pos);
    const lines = textBefore.split("\n");
    setCursorLine(lines.length);
    setCursorCol(lines[lines.length - 1].length + 1);
  }, []);

  // 粘贴图片落盘到文档同目录 assets/，插入相对路径（本轮 U2）。
  // 几 MB 的 base64 一旦进文档，之后每次按键都要被完整解析一遍；落盘后
  // 文档只留一行路径。未保存的文档（无落盘位置）退回 base64。
  const saveImagePaste = useCallback(async (dataUrl: string): Promise<string | null> => {
    const path = docRef.current.path;
    if (!path || !isTauri) return null;
    const m = /^data:image\/([a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return null;
    const dir = path.replace(/[^/\\]+$/, "");
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    const name = `paste-${Date.now()}.${ext}`;
    try {
      await invoke("save_paste_image", { path: `${dir}assets/${name}`, data: m[2] });
      return `assets/${name}`;
    } catch {
      return null;
    }
  }, []);

  // Click a cross-document link in the preview. Relative paths resolve
  // against the current document's directory.
  const onOpenDocument = useCallback((filePath: string) => {
    (async () => {
      if (!(await confirmDiscard())) return;
      let target = filePath;
      const isAbsolute = /^[/\\]/.test(filePath) || /^[A-Za-z]:[\\/]/.test(filePath);
      if (!isAbsolute) {
        // 剥掉文件名拿到所在目录。Windows 路径用反斜杠，必须同时处理两种分隔符，
        // 否则 base 恒为空、相对链接永远无法解析。
        const base = docRef.current.path?.replace(/[^/\\]+$/, "") ?? "";
        if (!base) {
          showToast(t("toast.cannotResolvePath"));
          return;
        }
        target = resolvePath(base, target);
      }
      try {
        if (!(await exists(target))) { showToast(t("toast.fileNotExists")); return; }
        const text = await readTextFile(target);
        setDoc({ path: target, content: text, modified: false });
        rememberPath(target);
      } catch {
        showToast(t("toast.cannotOpenFile"));
      }
    })();
  }, [confirmDiscard, rememberPath, showToast]);

  // Inject frontmatter title into document title (for PDF export / window title)
  useEffect(() => {
    if (frontmatterData?.title) {
      document.title = `${frontmatterData.title} — Rocktier Markdown`;
    } else if (doc.path) {
      document.title = `${baseName(doc.path)} — Rocktier Markdown`;
    } else {
      document.title = "Rocktier Markdown";
    }
  }, [frontmatterData, doc.path]);

  // frontmatter 面板支持 Esc 关闭（本轮 U6），与 FindReplace 行为一致
  useEffect(() => {
    if (!frontmatterOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setFrontmatterOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [frontmatterOpen]);

  const viewClass = view === "preview" ? "view-preview" : "";

  return (
    <div className={`app-shell ${viewClass}`}>
      <Toolbar
        viewMode={view}
        onToggleView={cycleView}
        onToggleSidebar={() => setSidebar((v) => !v)}
        onNew={doNew}
        onOpen={doOpen}
        onSave={doSave}
        modified={doc.modified}
        displayName={displayName}
        words={stats.words}
        minutes={stats.minutes}
        onToggleTheme={toggleTheme}
        onFindReplace={() => setFindReplaceOpen((v) => !v)}
        onExportPdf={doExportPdf}
        hasFrontmatter={hasFrontmatter}
        frontmatterOpen={frontmatterOpen}
        onToggleInfo={() => setFrontmatterOpen((v) => !v)}
      />
      <div
        className="app-body"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <Sidebar
          open={sidebar}
          onOpen={doOpen}
          onClose={() => setSidebar(false)}
          headings={headings}
          recent={recent}
          onOpenRecent={(p) => {
            openMarkdownPath(p);
            setSidebar(false);
          }}
          onJumpTo={(line) => {
            const el = editorRef.current;
            if (!el) return;
            const allLines = el.value.split("\n");
            let pos = 0;
            for (let i = 0; i < line - 1 && i < allLines.length; i++) {
              pos += allLines[i].length + 1;
            }
            el.focus();
            el.setSelectionRange(pos, pos);
            const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 25.2;
            el.scrollTop = Math.max(0, (line - 5) * lineHeight);
            setSidebar(false);
          }}
        />
        <main className="editor-container">
          {(view === "split" || view === "editor") && (
            <Editor
              content={doc.content}
              onChange={onChange}
              textareaRef={editorRef as React.RefObject<HTMLTextAreaElement>}
              onScroll={onEditorScroll}
              onImagePaste={() => showToast(t("toast.imageInserted"))}
              saveImagePaste={saveImagePaste}
              onCursorMove={onCursorMove}
            />
          )}
          {findReplaceOpen && (
            <FindReplace
              content={doc.content}
              textareaRef={editorRef as React.RefObject<HTMLTextAreaElement>}
              onChange={onChange}
              onClose={() => setFindReplaceOpen(false)}
            />
          )}
          {(view === "split" || view === "preview") && (
            <Preview
              html={html}
              previewRef={previewRef as React.RefObject<HTMLDivElement>}
              onScroll={onPreviewScroll}
              onToggleTask={toggleTask}
              taskLines={taskLines}
              onOpenDocument={onOpenDocument}
            />
          )}
        </main>
      </div>
      <StatusBar words={stats.words} line={cursorLine} column={cursorCol} gitBranch={gitBranch} />
      {frontmatterOpen && hasFrontmatter && frontmatterData && (
        <div className="frontmatter-panel" role="complementary" aria-label={t("fm.title")}>
          <div className="fm-header">
            <span className="fm-title">{t("fm.title")}</span>
            <button className="fm-close" onClick={() => setFrontmatterOpen(false)} aria-label={t("fm.close")}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>
          </div>
          <dl className="fm-body">
            {frontmatterData.title && <><dt>{t("fm.titleLabel")}</dt><dd>{frontmatterData.title}</dd></>}
            {frontmatterData.author && <><dt>{t("fm.author")}</dt><dd>{frontmatterData.author}</dd></>}
            {frontmatterData.date && <><dt>{t("fm.date")}</dt><dd>{frontmatterData.date}</dd></>}
          </dl>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
