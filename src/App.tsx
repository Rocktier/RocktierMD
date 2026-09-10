import { useState, useCallback, useEffect, useDeferredValue, useMemo, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "./components/Toolbar";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
import { Sidebar } from "./components/Sidebar";
import { FindReplace } from "./components/FindReplace";
import { useTheme, toggleTheme } from "./hooks/useTheme";
import { useScrollSync } from "./hooks/useScrollSync";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  parseDocument, extractHeadings, readStats, getTaskLines, parseFrontmatter,
  type Frontmatter,
} from "./services/markdown";
import { openFile, saveFile, saveFileAs, confirmDialog } from "./services/file";
import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { WELCOME_DOCUMENT, type MarkdownDocument, type ViewMode } from "./types/index";
import { t } from "./i18n";

const LAST_PATH_KEY = "rocktier-md-last-path";

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
  const toastRef = useRef(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const docRef = useRef(doc);
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

  // Restore last-opened document on launch (zero-click resume)
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let cancelled = false;
    const raw = localStorage.getItem(LAST_PATH_KEY);
    if (!raw) return;
    (async () => {
      try {
        if (!(await exists(raw))) return;
        const text = await readTextFile(raw);
        if (cancelled) return;
        setDoc({ path: raw, content: text, modified: false });
      } catch {
        // file moved or unreadable — ignore, start fresh
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Toggle task checkbox: use 1-based source line number to avoid index drift.
  const toggleTask = useCallback((lineNumber: number, checked: boolean) => {
    const el = editorRef.current;
    const start = el?.selectionStart ?? -1;
    const end = el?.selectionEnd ?? -1;
    setDoc((d) => {
      const lines = d.content.split("\n");
      const i = lineNumber - 1;
      if (i >= 0 && i < lines.length && /^\s*[-*+]\s+\[[ xX]\]/.test(lines[i])) {
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

  const rememberPath = useCallback((path: string | null) => {
    try {
      if (path) localStorage.setItem(LAST_PATH_KEY, path);
      else localStorage.removeItem(LAST_PATH_KEY);
    } catch {
      // storage full or unavailable — non-fatal
    }
  }, []);

  const doOpen = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    const r = await openFile();
    if (r) {
      setDoc({ path: r.path, content: r.content, modified: false });
      rememberPath(r.path);
      showToast(t("toast.fileOpened"));
    }
  }, [confirmDiscard, showToast, rememberPath]);

  const doSave = useCallback(async () => {
    const { path, content } = docRef.current;
    try {
      if (!path) {
        const p = await saveFileAs(content);
        if (!p) return;
        setDoc((d) => ({ ...d, path: p, modified: false }));
        rememberPath(p);
      } else {
        await saveFile(path, content);
        setDoc((d) => ({ ...d, modified: false }));
      }
      showToast(t("toast.saved"));
    } catch {
      showToast(t("toast.saveFailed"));
    }
  }, [showToast, rememberPath]);

  const doSaveAs = useCallback(async () => {
    try {
      const name = docRef.current.path ? baseName(docRef.current.path) : undefined;
      const p = await saveFileAs(docRef.current.content, name);
      if (p) {
        setDoc((d) => ({ ...d, path: p, modified: false }));
        rememberPath(p);
        showToast(t("toast.savedAs"));
      }
    } catch {
      showToast(t("toast.saveFailed"));
    }
  }, [showToast, rememberPath]);

  const doNew = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    setDoc({ path: null, content: "", modified: false });
    showToast(t("toast.newDoc"));
  }, [confirmDiscard, showToast]);

  const cycleView = useCallback(() => {
    setView((v) => (v === "split" ? "editor" : v === "editor" ? "preview" : "split"));
  }, []);

  // PDF export prints the preview pane. If the preview is hidden, mount it
  // first and restore the previous view when printing finishes.
  const doExportPdf = useCallback(() => {
    if (view !== "editor") {
      window.print();
      return;
    }
    setView("preview");
    window.addEventListener("afterprint", () => setView("editor"), { once: true });
    // Give React a frame to mount the preview before the print snapshot
    window.setTimeout(() => window.print(), 120);
  }, [view]);

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

  const displayName = doc.path ? baseName(doc.path) : "Untitled";
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
      const text = await readTextFile(path);
      setDoc({ path, content: text, modified: false });
      rememberPath(path);
      showToast(t("toast.fileOpened"));
      return true;
    } catch {
      showToast(t("toast.cannotReadFile"));
      return false;
    }
  }, [confirmDiscard, rememberPath, showToast]);

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
      const text = await (file as any).text();
      setDoc({ path: (file as any).path ?? null, content: text, modified: false });
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

  return (
    <div className="app-shell">
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
      {frontmatterOpen && hasFrontmatter && frontmatterData && (
        <div className="frontmatter-panel" role="complementary" aria-label={t("fm.title")}>
          <div className="fm-header">
            <span className="fm-title">{t("fm.title")}</span>
            <button className="fm-close" onClick={() => setFrontmatterOpen(false)} aria-label={t("fm.close")}>×</button>
          </div>
          <dl className="fm-body">
            {frontmatterData.title && <><dt>{t("fm.titleLabel")}</dt><dd>{frontmatterData.title}</dd></>}
            {frontmatterData.author && <><dt>{t("fm.author")}</dt><dd>{frontmatterData.author}</dd></>}
            {frontmatterData.date && <><dt>{t("fm.date")}</dt><dd>{frontmatterData.date}</dd></>}
          </dl>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
