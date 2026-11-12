import { describe, expect, it } from "vitest";
import {
  buildStandaloneHtml,
  inlineLocalImages,
  toBase64,
} from "./exportHtml";

describe("standalone HTML export", () => {
  it("produces one self-contained document with inlined styles and the rendered body", () => {
    const html = buildStandaloneHtml({
      title: "Notes",
      bodyHtml: "<h1>Hello</h1><p>World</p>",
      css: "p{color:red}",
    });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('data-theme="light"');
    expect(html).toContain("p{color:red}");
    expect(html).toContain('<style>');
    expect(html).toContain('<article class="md-viewer">');
    expect(html).toContain("<h1>Hello</h1><p>World</p>");
    // 外链样式表会让「离线可打开」变成假话
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/@import/i);
  });

  it("escapes the title so a document name cannot inject markup", () => {
    const html = buildStandaloneHtml({
      title: '<script>alert("x")</script>',
      bodyHtml: "<p>body</p>",
      css: "",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<title>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</title>");
  });

  it("records images it could not inline instead of silently dropping the fact", () => {
    const html = buildStandaloneHtml({
      title: "Images",
      bodyHtml: '<img src="https://example.com/a.png">',
      skippedImages: ["https://example.com/a.png", "weird --> path"],
    });
    expect(html).toContain("Images kept as references");
    expect(html).toContain("https://example.com/a.png");
    // 注释里的 --> 会提前闭合注释，必须被中和
    expect(html).toContain("-- >");
    expect(html).not.toContain("weird --> path");
  });

  it("uses the real family CSS by default", () => {
    const html = buildStandaloneHtml({ title: "t", bodyHtml: "" });
    expect(html).toContain(".md-viewer");
    expect(html).toContain("--bg-primary");
  });
});

describe("toBase64", () => {
  it("encodes bytes, including a chunk larger than one pass", () => {
    expect(toBase64(new Uint8Array([65, 66, 67]))).toBe("QUJD");
    const big = new Uint8Array(0x4000 + 3).fill(65);
    expect(toBase64(big).startsWith("QUFB")).toBe(true);
    expect(atob(toBase64(big)).length).toBe(big.length);
  });
});

describe("inlineLocalImages", () => {
  it("keeps data and remote images untouched and reports them as skipped", async () => {
    const body =
      '<img src="data:image/png;base64,QUJD">' +
      '<img src="https://example.com/photo.jpg">' +
      '<img src="./assets/local.png">';
    // 测试环境不是 Tauri：本地图片不读磁盘，原样保留。
    const result = await inlineLocalImages(body, "C:/docs/note.md");
    expect(result.html).toContain("data:image/png;base64,QUJD");
    expect(result.html).toContain("https://example.com/photo.jpg");
    expect(result.html).toContain("./assets/local.png");
    expect(result.skipped).toEqual([
      "data:image/png;base64,QUJD",
      "https://example.com/photo.jpg",
      "./assets/local.png",
    ]);
  });

  it("leaves a document with no images byte-for-byte alone", async () => {
    const body = "<h1>Title</h1><p>text</p>";
    const result = await inlineLocalImages(body, null);
    expect(result.html).toBe(body);
    expect(result.skipped).toEqual([]);
  });
});
