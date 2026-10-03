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
    "sidebar.outlineEmpty": "暂无标题——用 # 开始一节",
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
    "theme.mode.auto": "跟随系统",
    "theme.mode.light": "浅色",
    "theme.mode.dark": "深色",
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
    "confirm.recoverNamedNewer": "检测到未保存的草稿「{name}」，且它比磁盘上的文件新。是否恢复？",
    "confirm.recoverNamedOlder": "检测到未保存的草稿「{name}」，但它比磁盘上的文件旧。恢复会用旧内容覆盖磁盘，确定恢复吗？",
    "confirm.recoverNamedCount": "（本地另有 {n} 份未保存的草稿。）",
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
    "find.needEditorView": "切换到编辑视图以使用查找替换",
    "license.title": "许可与激活",
    "license.loading": "正在检查…",
    "license.trialLeft": "免费试用中 —— 还剩 {days} 天。",
    "license.trialChip": "试用 {days} 天",
    "license.expiredChip": "未激活",
    "license.expired": "试用已结束。阅读与预览仍可用；保存与导出需要许可。",
    "license.licensed": "已激活。谢谢。",
    "license.licensedFamily": "已激活 —— 全家桶，所有 Rocktier 应用均已解锁。",
    "license.licensedNote": "此副本已激活。此后不再有任何校验，也不联网。",
    "license.storeNote": "此副本购自微软商店，许可由商店负责。",
    "license.notConfigured": "此构建尚未配置验签公钥，暂时无法激活。请写信到 hello@rocktier.com。",
    "license.codeLabel": "激活码",
    "license.codePlaceholder": "RKT-…",
    "license.activate": "激活",
    "license.activating": "正在激活…",
    "license.buy": "购买 — $4.99",
    "license.close": "关闭",
    "license.invalid": "该激活码未被接受。请检查是否输错（不区分大小写）。",
    "license.wrongProduct": "这个激活码属于另一个 Rocktier 应用。每个应用各有自己的码，或者用全家桶（可解锁全部）。",
    "license.refunded": "这个激活码对应的购买已退款，因此不能再解锁。如属误判，请把订单号发到 hello@rocktier.com。",
    "license.offline": "连不上 rocktier.com。激活需要一次联网，之后便不再联网。",
    "license.whereToFind": "付款后页面上会显示激活码，购买确认邮件里也有一份。",
    "license.privacyNote": "激活会把激活码发送到 rocktier.com 一次，并把签名回执保存在本机。除此之外不传输任何内容。",
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
    "sidebar.outlineEmpty": "No headings yet — start a section with #",
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
    "theme.mode.auto": "Follow system",
    "theme.mode.light": "Light",
    "theme.mode.dark": "Dark",
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
    "confirm.recoverNamedNewer": "An unsaved draft for \"{name}\" was found and it is newer than the file on disk. Restore it?",
    "confirm.recoverNamedOlder": "An unsaved draft for \"{name}\" was found, but it is older than the file on disk. Restoring it would overwrite newer content. Restore anyway?",
    "confirm.recoverNamedCount": "({n} unsaved draft(s) in total.)",
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
    "find.needEditorView": "Switch to the editor view to use find & replace",
    "license.title": "License",
    "license.loading": "Checking…",
    "license.trialLeft": "Free trial — {days} day(s) left.",
    "license.trialChip": "Trial · {days}d",
    "license.expiredChip": "Not activated",
    "license.expired": "Your trial has ended. Reading and previewing still work; saving and exporting need a license.",
    "license.licensed": "Licensed. Thank you.",
    "license.licensedFamily": "Licensed — family bundle. Every Rocktier app is unlocked.",
    "license.licensedNote": "This copy is activated. No further checks, and no network access.",
    "license.storeNote": "This copy came from the Microsoft Store, so the Store handles the license for it.",
    "license.notConfigured": "This build cannot activate a code yet — it carries no verification key. Please write to hello@rocktier.com.",
    "license.codeLabel": "Activation code",
    "license.codePlaceholder": "RKT-…",
    "license.activate": "Activate",
    "license.activating": "Activating…",
    "license.buy": "Buy — $4.99",
    "license.close": "Close",
    "license.invalid": "That code was not accepted. Check it for a typo — the code is not case-sensitive.",
    "license.wrongProduct": "That code belongs to a different Rocktier app. Each app has its own code — or the family bundle, which unlocks all of them.",
    "license.refunded": "That code was refunded, so it no longer unlocks anything. If this is a mistake, write to hello@rocktier.com with your order number.",
    "license.offline": "Could not reach rocktier.com. Activating needs one connection; after that the app stays offline.",
    "license.whereToFind": "Your code was shown on the page right after payment, and is in the purchase email too.",
    "license.privacyNote": "Activating sends the code to rocktier.com once and stores the signed reply locally. Nothing else is sent.",
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
document.documentElement.lang = currentLang === "zh" ? "zh-CN" : currentLang;

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
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
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
