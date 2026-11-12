// Standalone single-file HTML export.
//
// 与「系统打印成 PDF」互补：PDF 是版式固定件，HTML 是可以发给别人、
// 双击就能在任何浏览器里打开的一份文件。要做到「单文件」，三样东西必须
// 全部塞进同一个 .html 里：样式、图片、正文。
//
// · 样式：Vite 的 ?raw 把家族 CSS 当字符串编进 bundle，导出时直接内联。
//   不引外链 stylesheet，也不 @import —— 断网、换机器、放进邮件附件都能看。
// · 图片：Markdown 里的相对路径是相对 .md 文件所在目录的。导出后 .html
//   往往被挪到别处，相对路径立刻全断，所以逐张读成本地字节转 data URI。
//   外链图片保持原样并在文件注释里如实标注（我们不会替它发请求）。
// · 正文：直接复用 parseDocument() 的渲染结果，保证与应用内预览同一套
//   GFM / 代码高亮 / KaTeX 输出，不另写一套渲染器。
//
// 已知降级：KaTeX 的 woff2 字体仍由 CSS 里的 /fonts/... 引用，独立打开时
// 公式会退回系统字体（排版可读，字形不完全一致）。把 20 多个字体文件全部
// base64 塞进每个导出文件并不划算；若将来要做「完全自包含」，在这一层补。

import { readFile } from "@tauri-apps/plugin-fs";
import tokensCss from "../styles/tokens.css?raw";
import globalCss from "../styles/global.css?raw";
import markdownCss from "../styles/markdown.css?raw";
import katexCss from "../styles/katex-woff2.css?raw";
import { resolvePath, baseDirOf } from "./path";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 家族样式按 main.tsx 的顺序拼好，另加独立页面所需的少量补偿。 */
export const EXPORT_CSS = [
  tokensCss,
  globalCss,
  markdownCss,
  katexCss,
  `
/* Standalone export: a light, print-friendly page with no app chrome. */
html, body { background: var(--bg-primary); }
body { margin: 0; }
.md-viewer { max-width: 760px; padding: 40px 24px 96px; }
@media print { .md-viewer { padding: 0; max-width: none; } }
`,
].join("\n");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

function mimeFor(path: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}

/** 分块编码，避免一张大图把 String.fromCharCode 的参数数量撑爆。 */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x4000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export interface InlineResult {
  html: string;
  /** 没能内联的图片（外链或读取失败），如实回报给调用方写进文件注释。 */
  skipped: string[];
}

/**
 * 把渲染结果里的本地图片换成 data URI。
 * 非 Tauri（浏览器 dev / 单元测试）下不读磁盘，原样返回并如实标记跳过。
 */
export async function inlineLocalImages(bodyHtml: string, filePath: string | null): Promise<InlineResult> {
  const doc = new DOMParser().parseFromString(`<div id="root">${bodyHtml}</div>`, "text/html");
  const imgs = Array.from(doc.querySelectorAll<HTMLImageElement>("img[src]"));
  const skipped: string[] = [];

  for (const img of imgs) {
    const src = img.getAttribute("src") || "";
    if (!src) continue;
    if (/^(https?:|data:|blob:|mailto:)/i.test(src)) {
      skipped.push(src);
      continue;
    }
    if (!filePath || !isTauri) {
      skipped.push(src);
      continue;
    }
    const base = baseDirOf(filePath);
    if (!base) {
      skipped.push(src);
      continue;
    }
    // 与 Preview.tsx 的 rewriteImageSources 用同一套路径解析规则。
    const pathPart = /^([^?#]*)/.exec(src)?.[1] ?? src;
    let decoded = pathPart;
    try { decoded = decodeURIComponent(decoded); } catch { /* 不是百分号编码，原样用 */ }
    const absolute = resolvePath(base, decoded);
    try {
      const bytes = await readFile(absolute);
      img.setAttribute("src", `data:${mimeFor(absolute)};base64,${toBase64(bytes)}`);
    } catch {
      // 一张图读不到不该让整份导出失败；保留原路径并如实记下。
      skipped.push(src);
    }
  }

  return { html: doc.getElementById("root")?.innerHTML ?? bodyHtml, skipped };
}

export interface StandaloneOptions {
  title: string;
  bodyHtml: string;
  /** 便于测试注入；生产环境用 EXPORT_CSS。 */
  css?: string;
  skippedImages?: string[];
  lang?: string;
}

/** 组装一份没有外部依赖的 HTML 文档。 */
export function buildStandaloneHtml(opts: StandaloneOptions): string {
  const css = opts.css ?? EXPORT_CSS;
  const note = opts.skippedImages?.length
    ? `\n<!-- Images kept as references (offline viewers may not show them):\n${opts.skippedImages
        .map((s) => `     ${s.replace(/-->/g, "-- >")}`)
        .join("\n")}\n-->\n`
    : "";
  return `<!doctype html>
<html lang="${escapeHtml(opts.lang ?? "en")}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Rocktier Markdown">
<title>${escapeHtml(opts.title)}</title>
<style>
${css}
</style>
</head>
<body>${note}<article class="md-viewer">
${opts.bodyHtml}
</article>
</body>
</html>
`;
}
