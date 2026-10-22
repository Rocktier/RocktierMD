import { describe, expect, it } from "vitest";
import { WELCOME_DOCUMENT } from "../types/index";
import { parseDocument } from "../services/markdown";

/**
 * 欢迎文档回归闸门（2026-10-22 世界百佳评审罪状 #8 的防线）。
 *
 * MD 首运文档曾自称 "reader"（它是编辑器）、拿达芬奇名言填空、
 * 还把没做的 Mermaid 和已实现的 KaTeX 一起塞进未勾选框清单。
 * 首次运行是产品的面试——这篇文档的答案不许再跑偏。
 * 断言全部对着真实实现写（parseDocument 真渲染、快捷键真存在）。
 */
describe("welcome document", () => {
  const { html } = parseDocument(WELCOME_DOCUMENT);

  it("self-labels as editor, not reader", () => {
    expect(WELCOME_DOCUMENT).toContain("Markdown editor");
    expect(WELCOME_DOCUMENT).not.toContain("Markdown reader");
  });

  it("contains no unimplemented-feature landmines and no quote filler", () => {
    expect(WELCOME_DOCUMENT).not.toContain("Mermaid");
    expect(WELCOME_DOCUMENT).not.toContain("KaTeX (math)");
    expect(WELCOME_DOCUMENT).not.toContain("da Vinci");
    expect(WELCOME_DOCUMENT).not.toContain("Simplicity is the ultimate");
  });

  it("renders live demos: math (KaTeX), table, task list, code", () => {
    expect(html).toContain("katex");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("language-rust");
    // 快捷键表里的反斜杠原样显示
    expect(html).toContain("Ctrl/Cmd + \\");
    // 不出现双反斜杠
    expect(html).not.toContain("Ctrl/Cmd + \\\\");
  });

  it("teaches real shortcuts that exist in the app", () => {
    for (const sc of ["Ctrl/Cmd + S", "Ctrl/Cmd + F", "Ctrl/Cmd + Shift + P"]) {
      expect(WELCOME_DOCUMENT).toContain(sc);
    }
  });

  it("draft-safety claims match the implementation (recovery copy, explicit save)", () => {
    expect(WELCOME_DOCUMENT).toContain("recovery copy");
    expect(WELCOME_DOCUMENT).not.toContain("auto-sav"); // 不承诺自动保存文件本身
  });
});
