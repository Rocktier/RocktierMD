// Markdown parsing + syntax highlighting
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";

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

const EXT = [gfm({ singleTilde: false })];
const HTML_EXT = [gfmHtml()];

export function parseMarkdown(src: string): string {
  const raw = micromark(src, {
    allowDangerousHtml: true,
    allowDangerousProtocol: false,
    extensions: EXT,
    htmlExtensions: HTML_EXT,
  });
  // allowDangerousHtml passes raw HTML through, so sanitize before it ever
  // reaches dangerouslySetInnerHTML (defense in depth on top of the CSP).
  return DOMPurify.sanitize(highlightCode(raw));
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
