// UI 文案统一走这里：此前工具栏是中文、侧栏/查找栏是英文、toast 中英混杂。
// 默认跟随系统语言（zh/en），选择持久化到 localStorage。
import { useEffect, useReducer } from "react";

type Lang = "zh" | "en";

const STORE_KEY = "rocktier-md-lang";

/** ⌘ on macOS, Ctrl+ elsewhere — the shortcut hints are written with ⌘ in the dictionary. */
const MOD_KEY =
  typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent) ? "⌘" : "Ctrl+";

const STRINGS = {
  zh: {
    "sidebar.files": "文件",
    "sidebar.recent": "最近打开",
    "sidebar.close": "关闭",
    "sidebar.actions": "操作",
    "sidebar.openFile": "打开文件",
    "sidebar.outline": "大纲",
    "sidebar.expandToc": "展开目录",
    "sidebar.collapseToc": "折叠目录",
    "sidebar.filterHeadings": "筛选标题…",
    "sidebar.shortcuts": "快捷键",
    "sc.new": "新建",
    "sc.open": "打开",
    "sc.save": "保存",
    "sc.saveAs": "另存为",
    "sc.find": "查找",
    "sc.exportPdf": "导出 PDF",
    "sc.sidebar": "侧栏",
    "sc.indent": "缩进",
    "toolbar.toggleSidebar": "切换侧栏 (\\)",
    "toolbar.editorOnly": "仅编辑",
    "toolbar.split": "分屏",
    "toolbar.previewOnly": "仅预览",
    "toolbar.statAria": "{n} 词 / {m} 分钟阅读",
    "toolbar.statTitle": "{n} words",
    "toolbar.new": "新建 (⌘N)",
    "toolbar.open": "打开 (⌘O)",
    "toolbar.save": "保存 (⌘S)",
    "toolbar.find": "查找替换 (⌘F)",
    "toolbar.exportPdf": "导出 PDF (⌘⇧P)",
    "toolbar.info": "文档信息",
    "toolbar.theme": "切换日夜模式",
    "toolbar.unsaved": "有未保存的更改",
    "find.find": "查找",
    "find.replace": "替换",
    "find.replaceAll": "全部替换",
    "find.prevTitle": "上一个匹配 (Shift+Enter)",
    "find.nextTitle": "下一个匹配 (Enter)",
    "find.replaceTitle": "替换当前匹配",
    "find.replaceAllTitle": "全部替换（可撤销）",
    "find.closeTitle": "关闭 (Esc)",
    "toast.fileOpened": "已打开",
    "toast.saved": "已保存",
    "toast.savedAs": "已另存为新文件",
    "toast.newDoc": "新文档",
    "toast.saveFailed": "保存失败：无法写入文件",
    "toast.unsupportedType": "不支持的文件类型",
    "toast.cannotReadFile": "无法读取文件",
    "toast.cannotResolvePath": "无法解析相对路径",
    "toast.fileNotExists": "文件不存在",
    "toast.cannotOpenFile": "无法打开文件",
    "toast.imageInserted": "图片已插入",
    "toast.reloaded": "已重新加载",
    "confirm.discard": "当前文档有未保存的更改，确定要丢弃吗？",
    "confirm.externalChange": "文件已在外部被修改。是否重新加载？未保存的更改将丢失。",
    "confirm.recover": "检测到未保存的草稿，是否恢复？",
    "confirm.recoverUntitled": "检测到一份从未保存的新文档草稿，是否恢复？",
    "doc.untitled": "未命名",
    "status.words": "{n} 词",
    "status.lineCol": "行 {line}，列 {col}",
    "fm.title": "文档信息",
    "fm.titleLabel": "标题",
    "fm.author": "作者",
    "fm.date": "日期",
    "fm.close": "关闭",
    "editor.placeholder": "开始编写 Markdown…",
    "find.matchCase": "区分大小写",
    "find.useRegex": "使用正则表达式",
  },
  en: {
    "sidebar.files": "Files",
    "sidebar.recent": "Recent",
    "sidebar.close": "Close",
    "sidebar.actions": "Actions",
    "sidebar.openFile": "Open File",
    "sidebar.outline": "Outline",
    "sidebar.expandToc": "Expand TOC",
    "sidebar.collapseToc": "Collapse TOC",
    "sidebar.filterHeadings": "Filter headings...",
    "sidebar.shortcuts": "Shortcuts",
    "sc.new": "New",
    "sc.open": "Open",
    "sc.save": "Save",
    "sc.saveAs": "Save as",
    "sc.find": "Find",
    "sc.exportPdf": "Export PDF",
    "sc.sidebar": "Sidebar",
    "sc.indent": "Indent",
    "toolbar.toggleSidebar": "Sidebar (\\)",
    "toolbar.editorOnly": "Editor only",
    "toolbar.split": "Split",
    "toolbar.previewOnly": "Preview only",
    "toolbar.statAria": "{n} words / {m} min read",
    "toolbar.statTitle": "{n} words",
    "toolbar.new": "New (⌘N)",
    "toolbar.open": "Open (⌘O)",
    "toolbar.save": "Save (⌘S)",
    "toolbar.find": "Find & Replace (⌘F)",
    "toolbar.exportPdf": "Export PDF (⌘⇧P)",
    "toolbar.info": "Document info",
    "toolbar.theme": "Toggle theme",
    "toolbar.unsaved": "Unsaved changes",
    "find.find": "Find",
    "find.replace": "Replace",
    "find.replaceAll": "All",
    "find.prevTitle": "Previous match (Shift+Enter)",
    "find.nextTitle": "Next match (Enter)",
    "find.replaceTitle": "Replace current match",
    "find.replaceAllTitle": "Replace all (undoable)",
    "find.closeTitle": "Close (Esc)",
    "toast.fileOpened": "File opened",
    "toast.saved": "Saved",
    "toast.savedAs": "Saved as new file",
    "toast.newDoc": "New document",
    "toast.saveFailed": "Save failed: unable to write file",
    "toast.unsupportedType": "Unsupported file type",
    "toast.cannotReadFile": "Unable to read file",
    "toast.cannotResolvePath": "Cannot resolve relative path",
    "toast.fileNotExists": "File not found",
    "toast.cannotOpenFile": "Unable to open file",
    "toast.imageInserted": "Image inserted",
    "toast.reloaded": "Reloaded",
    "confirm.discard": "This document has unsaved changes. Discard them?",
    "confirm.externalChange": "The file was changed externally. Reload it? Unsaved changes will be lost.",
    "confirm.recover": "An unsaved draft was found. Restore it?",
    "confirm.recoverUntitled": "An unsaved new document was found. Restore it?",
    "doc.untitled": "Untitled",
    "status.words": "{n} words",
    "status.lineCol": "Ln {line}, Col {col}",
    "fm.title": "Document info",
    "fm.titleLabel": "Title",
    "fm.author": "Author",
    "fm.date": "Date",
    "fm.close": "Close",
    "editor.placeholder": "Start writing Markdown...",
    "find.matchCase": "Match case",
    "find.useRegex": "Use regex",
  },
} as const;

export type UiLang = Lang;
export type UiKey = keyof typeof STRINGS.zh;

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // storage unavailable
  }
  // 家族规范：未显式选择过语言时默认英文，不跟随系统语言
  return "en";
}

let currentLang: Lang = detectLang();

const listeners = new Set<() => void>();

export function getUiLang(): Lang {
  return currentLang;
}

export function setUiLang(lang: Lang): void {
  currentLang = lang;
  try {
    localStorage.setItem(STORE_KEY, lang);
  } catch {
    // storage unavailable
  }
  listeners.forEach((fn) => fn());
}

export function t(key: UiKey, params?: Record<string, string | number>): string {
  let text: string = STRINGS[currentLang][key] ?? STRINGS.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  // 快捷键文案里的 ⌘ 集中替换：Windows 上显示 Ctrl+（此前按钮提示恒为 ⌘S）
  return text.replaceAll("⌘", MOD_KEY);
}

/** 订阅语言变化：语言切换时触发组件重渲染。 */
export function useUiLang(): Lang {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, [force]);
  return currentLang;
}
