import { en } from "./i18n.en";
import { ja } from "./i18n.ja";
import { ko } from "./i18n.ko";
import { de } from "./i18n.de";
import { es } from "./i18n.es";
import { pt } from "./i18n.pt";
import { ar } from "./i18n.ar";
// UI 文案统一走这里：此前工具栏是中文、侧栏/查找栏是英文、toast 中英混杂。
// 默认跟随系统语言（zh/en），选择持久化到 localStorage。
import { useEffect, useReducer } from "react";

/* 家族标准语言表 —— 单一真源，与 PDF / CAD / Sign / Compressor 同构。 */
export const LOCALES = [
  { code: "en", endonym: "English" },
  { code: "zh", endonym: "中文" },
  { code: "ja", endonym: "日本語" },
  { code: "ko", endonym: "한국어" },
  { code: "de", endonym: "Deutsch" },
  { code: "es", endonym: "Español" },
  { code: "pt", endonym: "Português" },
  { code: "ar", endonym: "العربية" },
] as const;

export type Lang = (typeof LOCALES)[number]["code"];

/* 2026-10-04 键改名（"rocktier-md-lang" → "rocktier.lang"），读取处回落旧键，
 * 理由同 App.tsx。语言是用户感知最强的偏好，重置一次就等于「中文用户变英文界面」。 */
const STORE_KEY = "rocktier.lang";
const STORE_KEY_LEGACY = "rocktier-md-lang";

/** ⌘ on macOS, Ctrl+ elsewhere — the shortcut hints are written with ⌘ in the dictionary. */
const MOD_KEY =
  typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent) ? "⌘" : "Ctrl+";

const STRINGS = {
  en, ja, ko, de, es, pt, ar,
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
    "license.buy": "购买 — $6.99",
    "license.close": "关闭",
    "license.invalid": "该激活码未被接受。请检查是否输错（不区分大小写）。",
    "license.wrongProduct": "这个激活码属于另一个 Rocktier 应用。每个应用各有自己的码，或者用全家桶（可解锁全部）。",
    "license.refunded": "这个激活码对应的购买已退款，因此不能再解锁。如属误判，请把订单号发到 hello@rocktier.com。",
    "license.offline": "连不上 rocktier.com。激活需要一次联网，之后便不再联网。",
    "license.whereToFind": "付款后页面上会显示激活码，购买确认邮件里也有一份。",
    "license.privacyNote": "激活会把激活码发送到 rocktier.com 一次，并把签名回执保存在本机。除此之外不传输任何内容。",
  },
} as const;

/** 键结构取自英文 —— 译文文件用这个类型做第二道保险（tsc 会校验）。 */
export type { Strings } from "./i18n.en";

export type UiLang = Lang;
export type UiKey = keyof typeof STRINGS.zh;

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORE_KEY) ?? localStorage.getItem(STORE_KEY_LEGACY);
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

// 供 scripts/gen-i18n.mjs 取真实键结构（esbuild 求值，不用正则猜 TS）
export const __en = en;
