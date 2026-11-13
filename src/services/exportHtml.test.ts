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

  // ── 以下三条钉住「真的读到了字节」那条路径 ────────────────────────────
  // v1.0.21 的 P0：capabilities 缺 fs:allow-read-file → 运行时 readFile 抛错
  // → 这里静默降级成「保留相对路径」，导出件看着成功其实没内联。而当时全部
  // 单测都走上面那个「非 Tauri 直接跳过」分支，成功路径一次都没跑过（D-140）。
  it("inlines a local image as a data URI when the bytes are readable", async () => {
    const seen: string[] = [];
    const result = await inlineLocalImages('<img src="./assets/local.png">', "/docs/note.md", {
      canReadDisk: true,
      readFile: async (p) => {
        seen.push(p);
        return new Uint8Array([0x41, 0x42, 0x43]); // "ABC"
      },
    });
    // 传给读盘的是相对 .md 所在目录解析后的绝对路径
    expect(seen).toEqual(["/docs/assets/local.png"]);
    expect(result.html).toContain("data:image/png;base64,QUJD");
    expect(result.html).not.toContain("./assets/local.png");
    expect(result.skipped).toEqual([]);
  });

  it("picks the MIME type from the file extension", async () => {
    const result = await inlineLocalImages('<img src="pic.JPG">', "/docs/note.md", {
      canReadDisk: true,
      readFile: async () => new Uint8Array([0xff, 0xd8]),
    });
    expect(result.html).toContain("data:image/jpeg;base64,");
  });

  it("falls back to a plain reference and reports it when the read is denied", async () => {
    // 权限缺失 / 文件不可读的真实形态：readFile 抛错。必须保留原路径并如实
    // 上报，而不是产出一个「看起来成功、实际缺图」的文件。
    const result = await inlineLocalImages('<img src="pic.png">', "/docs/note.md", {
      canReadDisk: true,
      readFile: async () => {
        throw new Error("fs.read_file not allowed. Permissions: fs:allow-read-file");
      },
    });
    expect(result.html).toContain('src="pic.png"');
    expect(result.html).not.toContain("data:image");
    expect(result.skipped).toEqual(["pic.png"]);
  });
});
