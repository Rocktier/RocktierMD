import { useState, useCallback, useEffect, useDeferredValue, useMemo, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Toolbar } from "./components/Toolbar";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
import { Sidebar } from "./components/Sidebar";
import { FindReplace } from "./components/FindReplace";
import { StatusBar } from "./components/StatusBar";
import { LicenseDialog } from "./components/LicenseDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { UpdateDialog } from "./components/UpdateDialog";
import { TabBar } from "./components/TabBar";
import { licenseStatus, onLicenseExpired, isLicenseExpiredError, revalidateLicence, type LicenseInfo } from "./services/license";
import { checkForUpdates, currentVersion, type UpdateResult, type UpdateState } from "./services/updates";
import { useTheme } from "./hooks/useTheme";
import { useScrollSync } from "./hooks/useScrollSync";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  parseDocument, extractHeadings, readStats, getTaskLines, parseFrontmatter,
  type Frontmatter,
} from "./services/markdown";
import {
  openFile, saveFile, saveFileAs, saveHtmlAs, normalizeEol, applyEol, type Eol,
} from "./services/file";
import { buildStandaloneHtml, inlineLocalImages } from "./services/exportHtml";
import {
  MAX_TABS, activeTabOf, closeTab, createTab, openTab, tabLabel, updateTabDoc,
  type DocumentTab,
} from "./services/tabs";
import { exists, readTextFile, stat } from "@tauri-apps/plugin-fs";

/** toast 语气。error 必须同时改变配色、存活时长与 aria role（家族铁律 7）。 */
type ToastTone = "info" | "success" | "error";

/** 一份文档各自的保存基线，按标签 id 存放（多标签下不再是全局单例）。 */
interface TabMeta {
  eol: Eol;
  savedContent: string;
  savedPath: string | null;
}
import { resolvePath, baseDirOf } from "./services/path";
import { WELCOME_DOCUMENT, type MarkdownDocument, type ViewMode } from "./types/index";
import { t, useUiLang } from "./i18n";
import { dropRecent, parseRecent, pushRecent } from "./recent";

/* 2026-10-04 键改名：家族命名空间统一用「.」，此前 MD 用的是 "rocktier-md-…"（连字符）。
 * 改名只为跨产品一致，不该顺手清掉用户已选的偏好 —— 所以读取处仍回落旧键。旧键不删。 */
/** 打包时写死，与 tag 同源 —— 不会出现系统里装着新版本而代码里写着旧版本的错位。 */
const VERSION = currentVersion();

const LAST_PATH_KEY = "rocktier.last-path";
const RECENT_KEY = "rocktier.md.recent";
const RECENT_KEY_LEGACY = "rocktier-md-recent";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MARKDOWN_EXTS = ["md", "markdown", "mdown", "mkd", "txt", "text"];

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() || "Untitled";
}

export default function App() {
  const { mode: themeMode, cycleTheme } = useTheme();
  // 订阅语言变化：App 内的 t()（toast、frontmatter 面板、确认弹窗）
  // 在切换语言后立即重渲染，避免半新半旧（复审 F9）。
  const lang = useUiLang();

  /* 多标签：文档不再是一个 state，而是一组标签 + 一个活动 id。
     `doc` 依旧按「当前文档」暴露给下面近千行的既有逻辑（编辑器、预览、状态栏、
     外部变更检测全都读它），所以改动集中在这一层，而不是散到每个消费点。
     纯逻辑（开/关/切换/上限）在 services/tabs.ts，有单测钉住。 */
  const [tabs, setTabs] = useState<DocumentTab[]>(() => [createTab({
    path: null,
    content: WELCOME_DOCUMENT,
    modified: false,
  })]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const activeIdRef = useRef(activeId);
  const activeTab = activeTabOf(tabs, activeId);
  const doc = activeTab.doc;

  /* 每份文档各自的「保存基线」与换行风格，按标签 id 存放。
     这些值曾经是三个全局 ref —— 多标签下那样会让 A 文档的基线跟着 B 文档走，
     于是外部修改检测会把磁盘旧内容判成「被外部改过」，或反过来把真实的外部
     修改吞掉。这里换成按标签存取，但**保持 `.current` 的读写形态**，
     调用点（保存、另存、外部检测、草稿恢复）一行都不用改。 */
  const tabMetaRef = useRef(new Map<string, TabMeta>([
    [tabs[0].id, { eol: "\n", savedContent: WELCOME_DOCUMENT, savedPath: null }],
  ]));
  const metaOf = useCallback((id: string): TabMeta => {
    let m = tabMetaRef.current.get(id);
    if (!m) {
      m = { eol: "\n", savedContent: "", savedPath: null };
      tabMetaRef.current.set(id, m);
    }
    return m;
  }, []);
  const eolRef = { get current() { return metaOf(activeIdRef.current).eol; },
                   set current(v: Eol) { metaOf(activeIdRef.current).eol = v; } };
  const lastSavedContentRef = { get current() { return metaOf(activeIdRef.current).savedContent; },
                                set current(v: string) { metaOf(activeIdRef.current).savedContent = v; } };
  const lastPathRef = { get current() { return metaOf(activeIdRef.current).savedPath; },
                        set current(v: string | null) { metaOf(activeIdRef.current).savedPath = v; } };

  /** 只改活动标签的文档 —— 与原来的 setDoc 同签名，支持函数式更新。 */
  const setDoc = useCallback((patch: MarkdownDocument | ((d: MarkdownDocument) => MarkdownDocument)) => {
    setTabs((ts) => updateTabDoc(ts, activeIdRef.current, patch));
  }, []);

  /* activeIdRef 必须在切换的那一刻同步更新：保存、起草稿、外部变更检测都在
     同一个 tick 里读它，等 effect 追上来就已经写到上一个标签上了。 */
  const switchTo = useCallback((id: string) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  /* 标签数组的镜像。开/关标签要基于「最新」的数组算，而 setState 的 updater
     是异步执行的；helper 内部每次算完都同步回写，连续两次操作也不会读到旧值。 */
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const [view, setView] = useState<ViewMode>("split");
  const [sidebar, setSidebar] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: ToastTone } | null>(null);
  const [frontmatterOpen, setFrontmatterOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [gitBranch, setGitBranch] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  // 授权（家族 L6）：状态轮询 + 对话框开关。null = 尚未取到（或浏览器 dev）。
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [licenseOpen, setLicenseOpen] = useState(false);
  /* B1：吊销复检判定 revoked 时置位，激活框顶部显示「许可已被吊销」专属通告 ——
     回执已清、info 与试用到期无从区分，verdict 是唯一可靠的传递点。 */
  const [licenseRevoked, setLicenseRevoked] = useState(false);
  /* 更新检查。状态只由用户点击推进 —— 没有任何 effect 会自动跑它，
     这是「除非你要求，应用不会联网」这条承诺的落点。 */
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);
  /* 结果框的开合。只由菜单「检查更新…」打开 —— 右下角常驻入口已移除
     （fixed 定位不稳定，容易盖住底部内容，Compressor v0.1.10 实测复现）。 */
  const [updateOpen, setUpdateOpen] = useState(false);
  const updateChecking = useRef(false);

  /* 应用内确认框（规范 v2 §7：禁止原生 ask / window.confirm）。
     Promise 化让「等用户点一下」保持原有 `if (await …)` 的调用形态。 */
  const [confirmReq, setConfirmReq] = useState<{
    message: string;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const askConfirm = useCallback(
    (message: string) => new Promise<boolean>((resolve) => setConfirmReq({ message, resolve })),
    []
  );
  const settleConfirm = useCallback((ok: boolean) => {
    setConfirmReq((req) => {
      req?.resolve(ok);
      return null;
    });
  }, []);
  const toastRef = useRef(0);
  const checkingRef = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const docRef = useRef(doc);
  // 新建文档在首次保存前的恢复 key（合成路径，磁盘上不存在）
  const UNTITLED_KEY = "__untitled__";
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 草稿是"尚未落盘的内容"的唯一副本，只在这些时刻清除：
  // 内容已成功写盘、或用户明确选择丢弃/不恢复。
  const clearRecovery = useCallback((key: string | null | undefined) => {
    if (!key || !isTauri) return;
    invoke("clear_recovery", { path: key }).catch(() => {});
  }, []);

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

  /* 大纲密度（设计稿 07 的签名元素：每条大纲右侧一根细条）。
     度量是真实的：每节占的行数 / 全文最长节的行数，归一到百分比。
     「哪一节太胖」一眼可见 —— 这比「我在第几行」更接近长文档的真实问题。 */
  const headingDensities = useMemo(() => {
    const lines = deferredContent.split("\n");
    const raw = headings.map((h, i) => {
      const start = Math.max(0, h.line - 1);
      const end =
        i + 1 < headings.length
          ? Math.max(start + 1, headings[i + 1].line - 1)
          : lines.length;
      return end - start;
    });
    const max = Math.max(1, ...raw);
    return raw.map((n) => Math.round((n / max) * 100));
  }, [headings, deferredContent]);
  const frontmatterData = useMemo<Frontmatter | null>(() =>
    parsed.frontmatter ? parseFrontmatter(parsed.frontmatter) : null, [parsed.frontmatter]);

  /*toast 分三种语气。此前成功与失败共用一个 .toast class、2 秒消失，
    「已保存」和「保存失败：无法写入文件」长得一模一样 —— 用户会以为文件存好了。
    这是数据层面的误导，优先级高于任何视觉问题（家族铁律 7）。
    失败还必须活得更久：错误提示消失得比成功快，是最常见的反模式。 */
  const showToast = useCallback((msg: string, tone: ToastTone = "info") => {
    setToast({ msg, tone });
    if (toastRef.current) window.clearTimeout(toastRef.current);
    const ttl = tone === "error" ? 6000 : 2000;
    toastRef.current = window.setTimeout(() => setToast(null), ttl);
  }, []);

  // ── License（家族 L6）：读一次试用状态；写操作被拦时由 Rust 发 license-expired
  //    事件（命令层统一发，界面不用在每个 catch 里各判一次），这里弹激活对话框并
  //    刷新状态。前端另有兜底：invoke 错误串含 LICENSE_EXPIRED 也开对话框。──
  const refreshLicense = useCallback(() => {
    if (!isTauri) return;
    licenseStatus()
      .then(setLicense)
      .catch(() => setLicense(null));
  }, []);

  const openLicense = useCallback(() => {
    setLicenseOpen(true);
    refreshLicense();
  }, [refreshLicense]);

  /* 检查更新。**只有这里会触发联网检查** —— 右下角入口与帮助菜单共用。
     用 ref 而非 state 判重：连点两次不该发出两个请求。 */
  const runUpdateCheck = useCallback(async () => {
    if (updateChecking.current) return;
    updateChecking.current = true;
    setUpdateState("checking");
    try {
      const result = await checkForUpdates();
      setUpdateResult(result);
      setUpdateState(result.hasUpdate ? "available" : "uptodate");
      /* 顺带吊销复检：同一次点击、同一承诺（只在点击时联网）。revoked → 清回执，
         授权状态回到未激活并弹激活对话框（openLicense 内含 refreshLicense）。 */
      const verdict = await revalidateLicence();
      if (verdict === "revoked") {
        setLicenseRevoked(true);
        openLicense();
      }
    } catch {
      setUpdateState("failed");
    } finally {
      updateChecking.current = false;
    }
  }, [openLicense]);

  useEffect(() => {
    refreshLicense();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void onLicenseExpired(() => {
      setLicenseOpen(true);
      refreshLicense();
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [refreshLicense]);

  const onChange = useCallback((content: string) => {
    setDoc((d) => ({ ...d, content, modified: true }));
  }, []);

  /* 关窗前的丢弃确认。多标签下必须看**所有**标签：只查当前标签的话，
     后台那张改过没保存的文档会随着关窗静默消失（草稿虽在，但用户以为存了）。 */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    const dirty = tabsRef.current.filter((tb) => tb.doc.modified);
    if (dirty.length === 0) return true;
    return askConfirm(
      dirty.length === 1 ? t("confirm.discard") : t("confirm.discardMany", { n: dirty.length }),
    );
  }, [askConfirm]);

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
        const list = parseRecent(
          localStorage.getItem(RECENT_KEY) ?? localStorage.getItem(RECENT_KEY_LEGACY),
        );
        const next = pushRecent(list, path);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        setRecent(next);
      } else {
        localStorage.removeItem(LAST_PATH_KEY);
      }
    } catch {
      // storage full or unavailable — non-fatal
    }
  }, []);

  /* 从「最近打开」里剔除一条访问不到的路径。
   *
   * 为什么要有它：沙箱版没有 security-scoped bookmark，本地保存的是绝对路径，
   * 重启或被移动后 open 会失败。此前失败只弹一句「无法读取文件」，条目永远留在
   * 列表里，每点一次失败一次 —— 用户看到的是「这个按钮坏了」，而不是「这个文件
   * 需要重新授权」。剔掉比留着诚实（D-152 之后的口径：宁可显式降级，不许静默）。 */
  const forgetRecent = useCallback((path: string) => {
    try {
      const list = parseRecent(localStorage.getItem(RECENT_KEY));
      const next = dropRecent(list, path);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      setRecent(next);
      if (localStorage.getItem(LAST_PATH_KEY) === path) localStorage.removeItem(LAST_PATH_KEY);
    } catch {
      // storage unavailable — 列表刷新失败不影响其它逻辑
    }
  }, []);

  // Load recent list on mount
  useEffect(() => {
    setRecent(parseRecent(localStorage.getItem(RECENT_KEY) ?? localStorage.getItem(RECENT_KEY_LEGACY)));
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
        // list_recovery 已按 modified_ms 倒序，故 [0] 即最新一份。
        // 普通启动时若没有未命名草稿，退而取最新的「命名文件」草稿——此前只查
        // __untitled__，命名文件的草稿在普通启动下永远不会被列出，用户崩溃前
        // 编辑的已命名文档等于找不回来。
        const namedDrafts = entries.filter((e) => e.path !== UNTITLED_KEY);
        const draft = opened
          ? entries.find((e) => e.path === opened.path)
          : entries.find((e) => e.path === UNTITLED_KEY) ?? namedDrafts[0];
        if (draft && !cancelled) {
          const untitled = draft.path === UNTITLED_KEY;
          if (!untitled && restored && restored.path === draft.path && restored.content === draft.content) {
            // 草稿与磁盘内容一致（上次正常保存过），直接清掉
            await invoke("clear_recovery", { path: draft.path }).catch(() => {});
          } else {
            // 普通启动命中「命名文件」草稿时，必须让用户看出草稿比磁盘新还是旧，
            // 否则可能拿旧内容覆盖磁盘上更新的内容。
            let message = t(untitled ? "confirm.recoverUntitled" : "confirm.recover");
            if (!untitled && !opened) {
              const name = draft.path.replace(/^.*[\\/]/, "");
              let stale = false;
              try {
                const info = await stat(draft.path);
                stale = (info.mtime ? info.mtime.getTime() : 0) > draft.modified_ms;
              } catch {
                // 磁盘文件不存在或不可读 → 草稿是唯一副本，按「新」处理
              }
              message = t(stale ? "confirm.recoverNamedOlder" : "confirm.recoverNamedNewer", { name });
              if (namedDrafts.length > 1) {
                message += "\n\n" + t("confirm.recoverNamedCount", { n: namedDrafts.length });
              }
            }
            if (await askConfirm(message)) {
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
              await invoke("clear_recovery", { path: draft.path }).catch(() => {});
            }
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
  }, [rememberPath, askConfirm]);

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

  /* 打开一份文档到标签栏。
     规则：活动标签还是一张没动过的空白页时，直接把它换成这份文档 —— 否则每
     打开一个文件就多留一张空白标签，几次之后就全是垃圾标签。 */
  const openInTab = useCallback((next: MarkdownDocument, meta: TabMeta): boolean => {
    const cur = activeTabOf(tabsRef.current, activeIdRef.current);
    const pristine = !cur.doc.path && !cur.doc.modified;
    const r = pristine
      ? { tabs: updateTabDoc(tabsRef.current, cur.id, next), activeId: cur.id, reused: false, limited: false }
      : openTab(tabsRef.current, activeIdRef.current, next);
    if (r.limited) {
      showToast(t("toast.tabLimit", { n: MAX_TABS }), "error");
      return false;
    }
    if (!r.reused) tabMetaRef.current.set(r.activeId, meta);
    tabsRef.current = r.tabs;
    setTabs(r.tabs);
    switchTo(r.activeId);
    return true;
  }, [showToast, switchTo]);

  const doOpen = useCallback(async () => {
    const r = await openFile();
    if (!r) return;
    // 达到标签上限时 openInTab 已经弹了 tabLimit（error）；不判返回值就会紧接着
    // 弹一条"已打开"，把真正的失败盖掉 —— 用户只看到成功、界面没变（D-141/T7）。
    if (!openInTab(
      { path: r.path, content: r.content, modified: false },
      { eol: r.eol, savedContent: r.content, savedPath: r.path },
    ))
      return;
    rememberPath(r.path);
    showToast(t("toast.fileOpened"), "success");
  }, [openInTab, showToast, rememberPath]);

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
      showToast(t("toast.saved"), "success");
    } catch (e) {
      // 事件链已弹对话框（license-expired）；这里兜错误串，防事件丢失时只剩裸失败。
      if (isLicenseExpiredError(e)) openLicense();
      else showToast(t("toast.saveFailed"), "error");
    }
  }, [showToast, rememberPath, clearRecovery, UNTITLED_KEY, openLicense]);

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
        showToast(t("toast.savedAs"), "success");
      }
    } catch (e) {
      if (isLicenseExpiredError(e)) openLicense();
      else showToast(t("toast.saveFailed"), "error");
    }
  }, [showToast, rememberPath, clearRecovery, UNTITLED_KEY, openLicense]);

  /* 新建＝开一张新标签。不再需要「先确认丢弃」：原来的文档留在它自己的标签里，
     什么都没被覆盖。 */
  const doNew = useCallback(() => {
    // 上限时 openInTab 已弹 tabLimit（error）；这里必须提前返回，否则会把它
    // 覆盖成绿色的 "New document"，用户以为新建成功而界面毫无变化（D-141/T7）。
    if (!openInTab(
      { path: null, content: "", modified: false },
      { eol: "\n", savedContent: "", savedPath: null },
    ))
      return;
    showToast(t("toast.newDoc"), "success");
  }, [openInTab, showToast]);

  /* 关标签。改过的先问 —— 关掉就是丢弃，所以连恢复草稿一起清，否则下次启动
     会把这份「用户已经明确不要了」的内容当成崩溃草稿弹回来。 */
  const doCloseTab = useCallback(async (id: string) => {
    const tab = tabsRef.current.find((tb) => tb.id === id);
    if (!tab) return;
    if (tab.doc.modified) {
      const name = tabLabel(tab, t("doc.untitled"));
      if (!(await askConfirm(t("confirm.closeDirty", { name })))) return;
      clearRecovery(tab.doc.path);
      if (!tab.doc.path) clearRecovery(UNTITLED_KEY);
    }
    const r = closeTab(tabsRef.current, activeIdRef.current, id, {
      path: null, content: "", modified: false,
    });
    tabMetaRef.current.delete(id);
    tabsRef.current = r.tabs;
    setTabs(r.tabs);
    switchTo(r.activeId);
  }, [askConfirm, clearRecovery, switchTo, UNTITLED_KEY]);

  // 查找替换依赖编辑器 textarea（原生 undo 栈），preview-only 下它未挂载，
  // next/replace 会静默 no-op。所有入口（工具栏按钮 / ⌘F / 原生菜单）统一走这里：
  // preview-only 时先切回分屏再开面板，保证面板打开时编辑器一定在场。
  const toggleFindReplace = useCallback(() => {
    if (findReplaceOpen) {
      setFindReplaceOpen(false);
      return;
    }
    if (view === "preview") setView("split");
    setFindReplaceOpen(true);
  }, [findReplaceOpen, view]);

  // 原生菜单跟随 UI 语言重建（macOS 顶栏的 文件/编辑/显示/窗口，本轮问题 2）
  useEffect(() => {
    if (!isTauri) return;
    invoke("build_menu", { lang }).catch(() => {});
  }, [lang]);

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
    } catch (e) {
      // 导出被授权闸门拦下 → 弹激活对话框；其余（打印不可用）维持原样不打断。
      if (isLicenseExpiredError(e)) openLicense();
    }
    if (wasEditor) setView("editor");
  }, [view, openLicense]);

  /** 单文件 HTML 导出：样式与本地图片都内联，脱离本应用、断网也能打开。
   *  与 PDF 导出一样走 save_document，因此受同一道授权闸门约束。 */
  const doExportHtml = useCallback(async () => {
    const current = docRef.current;
    try {
      const rendered = parseDocument(current.content).html;
      const { html, skipped } = await inlineLocalImages(rendered, current.path);
      const title = current.path ? baseName(current.path) : t("doc.untitled");
      const standalone = buildStandaloneHtml({
        title,
        bodyHtml: html,
        skippedImages: skipped,
        lang: lang === "zh" ? "zh" : "en",
      });
      const defaultName = `${title.replace(/\.[^./\\]+$/, "")}.html`;
      const saved = await saveHtmlAs(standalone, defaultName);
      if (saved) showToast(t("toast.htmlExported"), "success");
    } catch (e) {
      if (isLicenseExpiredError(e)) openLicense();
      else showToast(t("toast.htmlFailed"), "error");
    }
  }, [lang, showToast, openLicense]);

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
          case "find": toggleFindReplace(); break;
          case "export-pdf": doExportPdf(); break;
          case "export-html": doExportHtml(); break;
          case "toggle-sidebar": setSidebar((v) => !v); break;
          case "toggle-theme": cycleTheme(); break;
          case "license": openLicense(); break;
          case "website": void invoke('open_url', { url: 'https://rocktier.com/' }).catch(() => {}); break;
          case "feedback": void invoke('open_url', { url: 'mailto:hello@rocktier.com' }).catch(() => {}); break;
          case "check-updates": setUpdateOpen(true); void runUpdateCheck(); break;
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
  }, [doNew, doOpen, doSave, doSaveAs, doExportPdf, doExportHtml, toggleFindReplace, openLicense, runUpdateCheck]);

  const shortcuts = useMemo(
    () => ({
      onSave: doSave,
      onSaveAs: doSaveAs,
      onNew: doNew,
      onOpen: doOpen,
      onToggleSidebar: () => setSidebar((v) => !v),
      onFindReplace: toggleFindReplace,
      onExportPdf: doExportPdf,
    }),
    [doSave, doSaveAs, doNew, doOpen, doExportPdf, toggleFindReplace]
  );
  useKeyboardShortcuts(shortcuts);

  const displayName = doc.path ? baseName(doc.path) : t("doc.untitled");
  const hasFrontmatter = frontmatterData !== null;
  /* 预览更新中：useDeferredValue 还没追上最新输入，预览正落后于源码 ——
     这是真实的「进行中」，状态栏据此亮呼吸点。追上后自然回落。 */
  const syncing = deferredContent !== doc.content;
  /* 全文行数：按换行切分（空文档也是 1 行），与状态栏口径一致。 */
  const totalLines = doc.content.split("\n").length;

  // 在桌面端通过 Tauri 拖放事件 / 浏览器 dev 通过 HTML5 拖放打开文件。
  // 注意：打包版（dragDropEnabled 默认 true）下 HTML5 drop 不会触发，
  // 必须走 onDragDropEvent —— 此前只实现了 HTML5 路径，导致发布版拖拽失效。
  /* 打开一份 .md 并切到它的标签。
   *
   * 返回值区分「没打开」的三种原因，因为调用方要区别对待：标签上限不能当成
   * 文件失效（否则一次点满 5 个标签就会把最近列表里的文件全剔掉）。
   *
   * quiet: 由调用方自己负责报错文案时置 true —— 「最近打开」点失效条目要提示的是
   * 「请重新选择文件」，而不是通用的「无法读取文件」。
   */
  const openMarkdownPath = useCallback(async (
    path: string,
    opts?: { quiet?: boolean },
  ): Promise<"ok" | "unavailable" | "tab-limit" | "unsupported"> => {
    const report = (msg: string) => {
      if (!opts?.quiet) showToast(msg, "error");
    };
    const ext = path.split(".").pop()?.toLowerCase();
    if (!ext || !MARKDOWN_EXTS.includes(ext)) {
      report(t("toast.unsupportedType"));
      return "unsupported";
    }
    let loaded: { content: string; eol: Eol };
    try {
      // 沙箱（MAS）下对未授权路径的探测，究竟返回 false 还是直接抛错，
      // 没有在商店包上实测过（D-152 未验项），所以两种结局都收进同一个 try：
      // 无论哪种都归为「访问不到」，不再细分「不存在」与「没权限」。
      if (!(await exists(path))) {
        report(t("toast.fileNotExists"));
        return "unavailable";
      }
      loaded = normalizeEol(await readTextFile(path));
    } catch {
      report(t("toast.cannotReadFile"));
      return "unavailable";
    }
    if (!openInTab(
      { path, content: loaded.content, modified: false },
      { eol: loaded.eol, savedContent: loaded.content, savedPath: path },
    ))
      return "tab-limit";
    rememberPath(path);
    showToast(t("toast.fileOpened"), "success");
    return "ok";
  }, [openInTab, rememberPath, showToast]);

  /* 「最近打开」的点击入口。与普通打开的区别只有失败处理：
   * 访问不到就把它从列表里剔掉，并明确告诉用户下一步怎么做。
   * 标签满不算失效，其余原因一律不剔（unsupported 说明列表里存了脏数据，
   * 也顺手剔掉）。 */
  const openRecentPath = useCallback(async (path: string) => {
    const res = await openMarkdownPath(path, { quiet: true });
    if (res === "unavailable" || res === "unsupported") {
      forgetRecent(path);
      showToast(t("toast.recentUnavailable"), "error");
    }
  }, [forgetRecent, openMarkdownPath, showToast]);

  // Drag-and-drop file open (browser dev fallback; desktop uses onDragDropEvent)
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !MARKDOWN_EXTS.includes(ext)) {
      showToast(t("toast.unsupportedType"), "error");
      return;
    }
    try {
      const { content, eol } = normalizeEol(await (file as any).text());
      const droppedPath = (file as any).path ?? null;
      if (!openInTab(
        { path: droppedPath, content, modified: false },
        { eol, savedContent: content, savedPath: droppedPath },
      ))
        return;
      if (droppedPath) rememberPath(droppedPath);
      showToast(t("toast.fileOpened"), "success");
    } catch {
      showToast(t("toast.cannotReadFile"), "error");
    }
  }, [openInTab, rememberPath, showToast]);

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
    if (!path) path = UNTITLED_KEY;
    // 不再因内容为空就跳过：清空文档本身是一次编辑，跳过会让崩溃/重启后恢复出
    // 清空前的旧内容。调用点上游已有 doc.modified 守卫，只在真有改动时才会走到这里。
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
      const choice = await askConfirm(t("confirm.externalChange"));
      if (choice) {
        eolRef.current = eol;
        setDoc({ path, content: diskContent, modified: false });
        lastSavedContentRef.current = diskContent;
        showToast(t("toast.reloaded"), "success");
      } else {
        lastSavedContentRef.current = diskContent; // user dismissed — don't ask again
      }
    } catch {
      // file unreadable — ignore
    } finally {
      checkingRef.current = false;
    }
  }, [showToast, askConfirm]);

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
    // 只用毫秒时间戳命名：同一毫秒内两次粘贴会互相覆盖，文档里的旧链接会指向被
    // 替换掉的图片。目标已存在时递增后缀去重（复用现有 exists，不加新依赖）。
    const ts = Date.now();
    let name = `paste-${ts}.${ext}`;
    try {
      for (let i = 1; await exists(`${dir}assets/${name}`); i++) {
        name = `paste-${ts}-${i}.${ext}`;
      }
      await invoke("save_paste_image", { path: `${dir}assets/${name}`, data: m[2] });
      return `assets/${name}`;
    } catch (e) {
      // 图片落盘被闸门拦下：弹激活对话框；返回 null 交回编辑器走内联 base64 兜底
      // （不写盘的内容允许留在文档里，但保存会被拦）。
      if (isLicenseExpiredError(e)) openLicense();
      return null;
    }
  }, [openLicense]);

  // Click a cross-document link in the preview. Relative paths resolve
  // against the current document's directory.
  const onOpenDocument = useCallback((filePath: string) => {
    (async () => {
      let target = filePath;
      const isAbsolute = /^[/\\]/.test(filePath) || /^[A-Za-z]:[\\/]/.test(filePath);
      if (!isAbsolute) {
        // 剥掉文件名拿到所在目录。Windows 路径用反斜杠，必须同时处理两种分隔符，
        // 否则 base 恒为空、相对链接永远无法解析。
        const base = baseDirOf(docRef.current.path ?? "");
        if (!base) {
          showToast(t("toast.cannotResolvePath"), "error");
          return;
        }
        target = resolvePath(base, target);
      }
      // 走同一个打开例程：它会归一化换行、清掉上一篇的恢复草稿、重设保存基线。
      // 此前这里直接 setDoc，于是（a）从链接打开 CRLF 文档后保存会写成 \r\r\n，
      // 把整份文件搞坏；（b）上一篇的草稿一直残留，可能在下次启动时把旧内容灌回来。
      await openMarkdownPath(target);
    })();
  }, [openMarkdownPath, showToast]);

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
    <div className={`app-shell ${viewClass} ${sidebar ? "drawer-open" : ""}`}>
      <Toolbar
        viewMode={view}
        onSelectView={setView}
        onToggleSidebar={() => setSidebar((v) => !v)}
        onNew={doNew}
        onOpen={doOpen}
        onSave={doSave}
        modified={doc.modified}
        hasPath={!!doc.path}
        displayName={displayName}
        themeMode={themeMode}
        onToggleTheme={cycleTheme}
        onFindReplace={toggleFindReplace}
        onExportPdf={doExportPdf}
        onExportHtml={doExportHtml}
        hasFrontmatter={hasFrontmatter}
        frontmatterOpen={frontmatterOpen}
        onToggleInfo={() => setFrontmatterOpen((v) => !v)}
      />
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSelect={switchTo}
        onClose={doCloseTab}
        onNew={doNew}
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
          densities={headingDensities}
          recent={recent}
          currentPath={doc.path}
          onOpenRecent={(p) => {
            void openRecentPath(p);
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
              onImagePaste={() => showToast(t("toast.imageInserted"), "success")}
              saveImagePaste={saveImagePaste}
              onCursorMove={onCursorMove}
              line={cursorLine}
              col={cursorCol}
            />
          )}
          {findReplaceOpen && (
            <FindReplace
              content={doc.content}
              textareaRef={editorRef as React.RefObject<HTMLTextAreaElement>}
              onChange={onChange}
              onClose={() => setFindReplaceOpen(false)}
              disabled={view === "preview"}
            />
          )}
          {(view === "split" || view === "preview") && (
            <Preview
              html={html}
              filePath={doc.path ?? undefined}
              previewRef={previewRef as React.RefObject<HTMLDivElement>}
              onScroll={onPreviewScroll}
              onToggleTask={toggleTask}
              taskLines={taskLines}
              onOpenDocument={onOpenDocument}
              scrollSync={view === "split"}
            />
          )}
        </main>
      </div>
      <StatusBar
        words={stats.words}
        lines={totalLines}
        minutes={stats.minutes}
        displayName={displayName}
        hasPath={!!doc.path}
        modified={doc.modified}
        syncing={syncing}
        gitBranch={gitBranch}
        license={license}
        onLicenseClick={openLicense}
      />
      {/* 丢弃未保存更改 / 外部修改冲突 / 恢复草稿：应用内确认框。
          规范 v2 §7 禁止原生 ask()。 */}
      {confirmReq && (
        <ConfirmDialog message={confirmReq.message} onResolve={settleConfirm} />
      )}
      {/* 更新检查：入口在帮助菜单「检查更新…」，结果弹 UpdateDialog。
          右下角常驻悬浮入口已移除（fixed 定位不稳定，容易盖住底部内容）。 */}
      {updateOpen && (
        <UpdateDialog
          state={updateState}
          result={updateResult}
          currentVersion={VERSION}
          onClose={() => setUpdateOpen(false)}
        />
      )}
      {licenseOpen && (
        <LicenseDialog
          info={license}
          revoked={licenseRevoked}
          onRefresh={refreshLicense}
          onClose={() => { setLicenseOpen(false); setLicenseRevoked(false); }}
        />
      )}
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
      {toast && (
        <div
          className={toast.tone === "info" ? "toast" : `toast toast--${toast.tone}`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
