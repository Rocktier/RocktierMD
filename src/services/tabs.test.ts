import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_TABS,
  __resetTabIdForTest,
  activeTabOf,
  closeTab,
  createTab,
  openTab,
  tabLabel,
  updateTabDoc,
  type DocumentTab,
} from "./tabs";
import type { MarkdownDocument } from "../types/index";

const doc = (path: string | null, content = "x", modified = false): MarkdownDocument => ({
  path,
  content,
  modified,
});

beforeEach(() => __resetTabIdForTest());

describe("openTab", () => {
  it("adds a new tab and activates it", () => {
    const first = createTab(doc(null));
    const r = openTab([first], first.id, doc("/a.md"));
    expect(r.tabs).toHaveLength(2);
    expect(r.tabs[1].doc.path).toBe("/a.md");
    expect(r.activeId).toBe(r.tabs[1].id);
    expect(r.reused).toBe(false);
  });

  it("reuses the tab that already holds the same path instead of duplicating it", () => {
    const a = createTab(doc("/a.md", "first"));
    const b = createTab(doc("/b.md"));
    // 同路径再次打开：不能出现两个 /a.md，也不能覆盖已有内容
    const r = openTab([a, b], b.id, doc("/a.md", "second"));
    expect(r.tabs).toHaveLength(2);
    expect(r.reused).toBe(true);
    expect(r.activeId).toBe(a.id);
    expect(activeTabOf(r.tabs, r.activeId).doc.content).toBe("first");
  });

  it("never dedupes untitled documents, since they have no path", () => {
    const a = createTab(doc(null, "one"));
    const r = openTab([a], a.id, doc(null, "two"));
    expect(r.tabs).toHaveLength(2);
    expect(r.reused).toBe(false);
  });

  it("refuses to exceed the limit rather than closing someone else's tab", () => {
    const tabs: DocumentTab[] = [];
    for (let i = 0; i < MAX_TABS; i++) tabs.push(createTab(doc(`/f${i}.md`)));
    const r = openTab(tabs, tabs[0].id, doc("/new.md"));
    expect(r.limited).toBe(true);
    expect(r.tabs).toHaveLength(MAX_TABS);
    expect(r.activeId).toBe(tabs[0].id);
  });
});

describe("closeTab", () => {
  it("falls to the right neighbour like a browser does", () => {
    const a = createTab(doc("/a.md"));
    const b = createTab(doc("/b.md"));
    const c = createTab(doc("/c.md"));
    const r = closeTab([a, b, c], b.id, b.id, doc(null, ""));
    expect(r.tabs.map((t) => t.doc.path)).toEqual(["/a.md", "/c.md"]);
    expect(r.activeId).toBe(c.id);
  });

  it("falls to the left neighbour when closing the last one", () => {
    const a = createTab(doc("/a.md"));
    const b = createTab(doc("/b.md"));
    const r = closeTab([a, b], b.id, b.id, doc(null, ""));
    expect(r.activeId).toBe(a.id);
  });

  it("keeps the active tab when a background tab is closed", () => {
    const a = createTab(doc("/a.md"));
    const b = createTab(doc("/b.md"));
    const r = closeTab([a, b], b.id, a.id, doc(null, ""));
    expect(r.activeId).toBe(b.id);
    expect(r.createdBlank).toBe(false);
  });

  it("leaves one blank tab instead of a zero-tab app", () => {
    const a = createTab(doc("/a.md"));
    const r = closeTab([a], a.id, a.id, doc(null, ""));
    expect(r.tabs).toHaveLength(1);
    expect(r.tabs[0].doc.path).toBeNull();
    expect(r.activeId).toBe(r.tabs[0].id);
    expect(r.createdBlank).toBe(true);
  });

  it("ignores an unknown id", () => {
    const a = createTab(doc("/a.md"));
    const r = closeTab([a], a.id, "nope", doc(null, ""));
    expect(r.tabs).toEqual([a]);
    expect(r.activeId).toBe(a.id);
  });
});

describe("updateTabDoc", () => {
  it("updates only the target tab", () => {
    const a = createTab(doc("/a.md", "a"));
    const b = createTab(doc("/b.md", "b"));
    const next = updateTabDoc([a, b], b.id, (d) => ({ ...d, content: "B2", modified: true }));
    expect(next[0]).toBe(a);
    expect(next[1].doc.content).toBe("B2");
    expect(next[1].doc.modified).toBe(true);
  });

  it("returns the same array when the updater changes nothing", () => {
    const a = createTab(doc("/a.md", "a"));
    const tabs = [a];
    expect(updateTabDoc(tabs, a.id, (d) => d)).toBe(tabs);
  });
});

describe("tabLabel", () => {
  it("uses the file name for saved documents", () => {
    expect(tabLabel(createTab(doc("/notes/today.md")), "Untitled")).toBe("today.md");
    expect(tabLabel(createTab(doc("C:\\notes\\today.md")), "Untitled")).toBe("today.md");
  });

  it("falls back to the placeholder for untitled documents", () => {
    expect(tabLabel(createTab(doc(null)), "Untitled")).toBe("Untitled");
  });
});
