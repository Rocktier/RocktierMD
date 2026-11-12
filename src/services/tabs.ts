// 多标签的纯逻辑层。
//
// 这里刻意不碰 React、不碰磁盘：标签的开/关/切换都是纯函数，规则全部
// 可以用单测钉住。App.tsx 只负责把结果灌进 state。
//
// 三条规则值得写清楚，因为它们决定了「会不会丢内容」：
// 1. 已经有同路径的标签时，打开该文件＝切到那个标签，**不**新建第二个。
//    同一份文件开两个标签，两边各自编辑，最后谁都说不清磁盘上该是哪份。
// 2. 未命名文档没有路径，无法判重，每次新建都给一个新标签。
// 3. 关掉最后一个标签时补一张空白标签，不出现「零标签」状态 —— 零标签的
//    应用看起来像坏了，且之后所有「当前文档」的读取都要判空。
//
// 标签数量有上限：超过就拒绝新建并告诉调用方，而不是静默关掉别人没保存的
// 标签腾地方。

import type { MarkdownDocument } from "../types/index";

export interface DocumentTab {
  id: string;
  doc: MarkdownDocument;
}

export const MAX_TABS = 12;

let seq = 0;

export function nextTabId(): string {
  seq += 1;
  return `tab-${seq}`;
}

/** 仅测试用：让 id 从固定值开始，避免断言依赖全局计数。 */
export function __resetTabIdForTest(): void {
  seq = 0;
}

export function createTab(doc: MarkdownDocument, id: string = nextTabId()): DocumentTab {
  return { id, doc };
}

export function activeTabOf(tabs: DocumentTab[], activeId: string): DocumentTab {
  return tabs.find((t) => t.id === activeId) ?? tabs[0];
}

export interface OpenResult {
  tabs: DocumentTab[];
  activeId: string;
  /** 命中已有同路径标签（此时 tabs 原样返回，只是切了活动标签）。 */
  reused: boolean;
  /** 达到上限被拒绝。 */
  limited: boolean;
}

/**
 * 打开一份文档：同路径复用，否则新建。
 * `reused` 时不覆盖已有内容 —— 磁盘上新旧如何取舍由外部变更检测那条路径
 * 单独处理（它有基线、有确认框），不该在「切标签」时悄悄替换。
 */
export function openTab(
  tabs: DocumentTab[],
  activeId: string,
  doc: MarkdownDocument,
  id: string = nextTabId(),
): OpenResult {
  if (doc.path) {
    const existing = tabs.find((t) => t.doc.path === doc.path);
    if (existing) return { tabs, activeId: existing.id, reused: true, limited: false };
  }
  if (tabs.length >= MAX_TABS) return { tabs, activeId, reused: false, limited: true };
  const tab = createTab(doc, id);
  return { tabs: [...tabs, tab], activeId: tab.id, reused: false, limited: false };
}

export interface CloseResult {
  tabs: DocumentTab[];
  activeId: string;
  /** 关掉的是最后一张，补了一张空白标签。 */
  createdBlank: boolean;
}

/** 关标签。关掉的若是活动标签，优先落到右邻居，没有则落到左邻居。 */
export function closeTab(
  tabs: DocumentTab[],
  activeId: string,
  id: string,
  blankDoc: MarkdownDocument,
  newId: string = nextTabId(),
): CloseResult {
  const index = tabs.findIndex((t) => t.id === id);
  if (index < 0) return { tabs, activeId, createdBlank: false };

  const remaining = tabs.filter((t) => t.id !== id);
  if (remaining.length === 0) {
    const blank = createTab(blankDoc, newId);
    return { tabs: [blank], activeId: blank.id, createdBlank: true };
  }
  if (activeId !== id) return { tabs: remaining, activeId, createdBlank: false };

  // 右侧邻居在 remaining 里的位置就是原 index（原 index 之后的元素前移了一位）
  const next = remaining[Math.min(index, remaining.length - 1)];
  return { tabs: remaining, activeId: next.id, createdBlank: false };
}

/** 就地改某个标签的文档（保存后清 modified、另存后改 path 都走这里）。 */
export function updateTabDoc(
  tabs: DocumentTab[],
  id: string,
  patch: MarkdownDocument | ((d: MarkdownDocument) => MarkdownDocument),
): DocumentTab[] {
  let changed = false;
  const next = tabs.map((t) => {
    if (t.id !== id) return t;
    const doc = typeof patch === "function" ? patch(t.doc) : patch;
    if (doc === t.doc) return t;
    changed = true;
    return { ...t, doc };
  });
  return changed ? next : tabs;
}

/** 标签标题：磁盘文件用文件名，未落盘用占位文案。 */
export function tabLabel(tab: DocumentTab, untitled: string): string {
  const path = tab.doc.path;
  if (!path) return untitled;
  const name = path.split(/[/\\]/).pop();
  return name || untitled;
}
