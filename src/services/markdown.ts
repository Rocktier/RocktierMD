// Markdown parsing + syntax highlighting
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { gfmFootnote, gfmFootnoteHtml } from "micromark-extension-gfm-footnote";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import katex from "katex";

// Minimal language set for 极致快: 5 core languages, ~80KB vs ~350KB full
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);

import type { Extension } from "micromark-util-types";

const EXT: Extension[] = [gfmFootnote(), gfm({ singleTilde: false })];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HTML_EXT: any[] = [gfmFootnoteHtml(), gfmHtml()];

// --- Math extraction: pull out KaTeX before micromark sees the source ----
// Replaced after DOMPurify to avoid KaTeX HTML being sanitized away.
const MATH_SLOT = (n: number) => `<!--__rocktier_MATH_${n}__-->`;

export interface ParseResult {
  html: string;
  frontmatter: string | null;
}

export function parseMarkdown(src: string): string {
  return parseDocument(src).html;
}

export function parseDocument(src: string): ParseResult {
  // 1. Extract frontmatter
  const { body, frontmatter } = extractFrontmatter(src);

  // 2. Extract math blocks before micromark so LaTeX doesn't get mangled
  const mathStore: string[] = [];
  let text = body.replace(/\$\$([\s\S]*?)\$\$/g, (_m, tex) => {
    const i = mathStore.length;
    mathStore.push(`<div class="katex-block">${renderMath(tex, true)}</div>`);
    return MATH_SLOT(i);
  });
  // Inline math: $...$ (must not start/end with whitespace, must be non-empty)
  text = text.replace(/(^|[^\\])\$(?=\S)(.+?)(?<=\S)\$(?!\$)/g, (_m, pre, tex) => {
    const i = mathStore.length;
    mathStore.push(`<span class="katex-inline">${renderMath(tex, false)}</span>`);
    return `${pre}${MATH_SLOT(i)}`;
  });
  // Unescape any \$ that we skipped
  text = text.replace(/\\\$/g, "$");

  // 3. Image resize syntax: ![alt](url =200x100)
  //    Strip "=WxH" before micromark, re-apply on the img tags after render.
  const sizeMap = new Map<string, { w: number; h: number | null }>();
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\s*=(\d+)(?:x(\d+))?\)/g,
    (_m, alt: string, url: string, w: string, h: string) => {
      sizeMap.set(url, { w: +w, h: h ? +h : null });
      return `![${alt}](${url})`;
    });

  // 4. Parse with micromark
  const raw = micromark(text, {
    allowDangerousHtml: true,
    allowDangerousProtocol: false,
    extensions: EXT,
    htmlExtensions: HTML_EXT,
  });

  // 5. Highlight + sanitize
  let html = DOMPurify.sanitize(highlightCode(raw));

  // 6. Re-apply image sizes (width/height attributes)
  if (sizeMap.size > 0) {
    html = html.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)>/g, (_m, pre: string, url: string, post: string) => {
      const sz = sizeMap.get(decodeURIComponent(url));
      if (!sz) return _m;
      // Skip if width/height already present (raw HTML user override)
      const hasW = /width=/.test(pre) || /width=/.test(post);
      const hasH = /height=/.test(pre) || /height=/.test(post);
      const wAttr = hasW ? '' : ` width="${sz.w}"`;
      const hAttr = sz.h && !hasH ? ` height="${sz.h}"` : '';
      return `<img${pre}src="${url}"${post}${wAttr}${hAttr}>`;
    });
  }

  // 7. Restore math slots after DOMPurify
  for (let i = 0; i < mathStore.length; i++) {
    html = html.replace(MATH_SLOT(i), mathStore[i]);
  }

  return { html, frontmatter };
}

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return `<code class="katex-error">${escapeHtml(tex)}</code>`;
  }
}

export interface Frontmatter {
  raw: string;
  title?: string;
  author?: string;
  date?: string;
  [key: string]: string | undefined;
}

export function extractFrontmatter(src: string): { body: string; frontmatter: string | null } {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return { body: src, frontmatter: null };
  return { body: src.slice(m[0].length), frontmatter: m[1] };
}

/** Parse frontmatter string into key:value map (YAML subset) */
export function parseFrontmatter(raw: string): Frontmatter {
  const result: Frontmatter = { raw };
  raw.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx <= 0) return;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && val) result[key] = val;
  });
  return result;
}

function highlightCode(html: string): string {
  return html.replace(
    /<code class="language-([^"]+)">([\s\S]*?)<\/code>/g,
    (_match, lang: string, code: string) => {
      const decoded = decodeHtml(code);
      let highlighted: string;
      try {
        if (hljs.getLanguage(lang)) {
          highlighted = hljs.highlight(decoded, { language: lang }).value;
        } else if (decoded.length <= 20000) {
          // Auto-detection is expensive; skip it for very large code blocks
          highlighted = hljs.highlightAuto(decoded).value;
        } else {
          highlighted = escapeHtml(decoded);
        }
      } catch {
        highlighted = escapeHtml(decoded);
      }
      return `<code class="hljs language-${lang}" data-lang="${lang}">${highlighted}</code>`;
    }
  );
}

function decodeHtml(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface Heading {
  level: number;
  text: string;
  id: string;
  line: number; // 1-based line number in source
}

export function extractHeadings(src: string): Heading[] {
  const headings: Heading[] = [];
  let inCodeBlock = false;
  src.split("\n").forEach((line, idx) => {
    // Skip headings inside fenced code blocks
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      headings.push({
        level: m[1].length,
        text: m[2].replace(/\s+#+$/, "").trim(),
        id: slugify(stripInlineMarkers(m[2])),
        line: idx + 1,
      });
    }
  });
  return headings;
}

/**
 * Return 1-based line numbers of every GFM task-list item in the source.
 * Used to correlate rendered checkboxes back to source lines without drift.
 */
export function getTaskLines(src: string): number[] {
  const lines: number[] = [];
  src.split("\n").forEach((line, idx) => {
    if (/^\s*[-*+]\s+\[[ xX]\]/.test(line)) lines.push(idx + 1);
  });
  return lines;
}

/** Strip markdown inline markers for slug generation (bold, italic, code, links) */
function stripInlineMarkers(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Shared internal: returns cn/en/total counts to avoid re-matching the text.
function wordCounts(text: string): { cn: number; en: number; total: number } {
  // CJK unified ideographs: Extension A (3400-4DBF), URO (4E00-9FFF),
  // Compatibility Ideographs (F900-FAFF)
  const cn = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const en = (text.match(/[a-zA-Z0-9_]+/g) || []).length;
  return { cn, en, total: cn + en };
}

export function countWords(text: string): number {
  return wordCounts(text).total;
}

export function readTime(text: string): number {
  const { cn, total } = wordCounts(text);
  if (total === 0) return 0;
  // Blended WPM: pure English → 350, pure Chinese → 500
  const ratio = cn / total;
  const wpm = 350 + ratio * 150;
  return Math.max(1, Math.ceil(total / wpm));
}
