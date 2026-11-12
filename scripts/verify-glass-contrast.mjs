#!/usr/bin/env node
/**
 * 玻璃材质对比度判据（2026-11-12，lenso 材质落地时立）
 *
 * 为什么需要它：
 *   家族的 contrast-gate 判据①做的是「文字令牌 × 表面令牌」矩阵，矩阵里的
 *   表面全是不透明令牌值（--bg-primary / --bg-card …）。玻璃是**半透明**
 *   的，它压在什么上面，最终颜色就是什么 —— 矩阵结构上看不见这件事。
 *   于是「闸门全绿，同一时刻屏幕上是 3:1」这一类事故，在材质换成玻璃之后
 *   会重新长出来（2026-10 的 OCR 白底白字就是这么漏的，D-14）。
 *
 * 判据：按真实叠层顺序合成，再算 WCAG 对比度。
 *     底（极端色） → 遮罩（--scrim，仅浮层） → 玻璃（渐变两档取较差的一档）
 *     → 文字令牌（本身可能半透明）
 *   底取纯白与纯黑两个极端：预览里可以是一张白底扫描件，也可以是一张
 *   夜空照片，玻璃必须在这两端都成立。
 *
 * 颜色一律从 src/styles/app.css 的 --glass-* 令牌里读，不在本文件复写，
 * 否则「判据通过」和「CSS 里的值」会慢慢分叉（D-90 的老毛病）。
 *
 * 用法: node scripts/verify-glass-contrast.mjs [--selftest]
 * 退出码: 0 = PASS, 1 = FAIL
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const APP_CSS = join(here, "..", "src", "styles", "app.css");
const TOKENS_CSS = join(here, "..", "src", "styles", "tokens.css");

/* ---------- 颜色解析与 WCAG ---------- */

function parseColor(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return { rgb: [m[1][0], m[1][1], m[1][2]].map((h) => parseInt(h + h, 16)), a: 1 };
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const h = m[1];
    return {
      rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)],
      a: 1,
    };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(",").map((x) => parseFloat(x.trim()));
    if (p.length < 3 || p.slice(0, 3).some(isNaN)) return null;
    return { rgb: p.slice(0, 3), a: p.length > 3 && !isNaN(p[3]) ? p[3] : 1 };
  }
  return null;
}

const over = (fg, bg) => [0, 1, 2].map((i) => fg.rgb[i] * fg.a + bg[i] * (1 - fg.a));

function lin(v) {
  v /= 255;
  return v > 0.03928 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
}
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
function contrast(fg, bg) {
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* ---------- CSS 令牌块解析 ---------- */

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** 抓取所有主题块，按选择器判定 dark / light（:root 视为深色档，与母版一致） */
function themeTokens(css) {
  const out = { dark: new Map(), light: new Map() };
  const re = /(:root[^{]*|\[data-theme="(?:light|dark)"\])\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    const head = m[1];
    const scope = head.includes("light") ? "light" : "dark";
    let i = m.index + m[0].length, depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    const body = css.slice(m.index + m[0].length, i - 1);
    const dre = /(^|[;{\s])(--[A-Za-z0-9-_]+)\s*:\s*([^;}]+)/g;
    let d;
    while ((d = dre.exec(body))) out[scope].set(d[2], d[3].trim());
  }
  return out;
}

const appTokens = themeTokens(stripComments(readFileSync(APP_CSS, "utf8")));
const masterTokens = themeTokens(stripComments(readFileSync(TOKENS_CSS, "utf8")));

/* 浅色档缺的令牌按母版规则回落深色档（与浏览器实际行为一致） */
const merged = (theme) => new Map([...masterTokens.dark, ...appTokens[theme], ...masterTokens[theme]]);

/* ---------- 极端底 ---------- */

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

/* ---------- 表面定义 ---------- */

/* layers：玻璃渐变的两个止点（单止点就写一个）。
   backdrops：该表面可能压住的底。scrim 前缀表示「先盖一层 --scrim」。
   tokens：这一层上实际会出现的文字令牌（按真实用法取，不图省事全上）。 */
const ROLES = [
  {
    id: "chrome",
    label: "工具条 / 标签栏",
    layers: ["--glass-chrome-a", "--glass-chrome-b"],
    backdrops: ["canvas"],
    tokens: ["--text-primary", "--text-secondary", "--text-tertiary"],
  },
  {
    id: "pane",
    label: "编辑器 / 预览面板（不透明安静面）",
    layers: ["--pane-bg"],
    backdrops: ["canvas"],
    tokens: ["--text-primary", "--text-secondary", "--text-tertiary"],
  },
  {
    id: "drawer",
    label: "侧栏抽屉（遮罩托底，无危险色文本）",
    layers: ["--glass-drawer-a", "--glass-drawer-b"],
    backdrops: ["scrim:white", "scrim:black"],
    tokens: ["--text-primary", "--text-secondary", "--text-tertiary"],
  },
  {
    id: "panel",
    label: "模态对话框（遮罩托底，含 --danger 文本）",
    layers: ["--glass-panel-a", "--glass-panel-b"],
    backdrops: ["scrim:white", "scrim:black"],
    tokens: ["--text-primary", "--text-secondary", "--text-tertiary", "--danger"],
  },
  {
    id: "float",
    label: "toast / 查找条 / 文档信息（直接压在任意内容上）",
    layers: ["--glass-float-a", "--glass-float-b"],
    backdrops: ["white", "black"],
    tokens: ["--text-primary", "--text-secondary"],
  },
  {
    id: "pill",
    label: "状态条胶囊 / 文件名胶囊",
    layers: ["--glass-pill-a", "--glass-pill-b"],
    backdrops: ["canvas", "chrome"],
    tokens: ["--text-secondary", "--text-tertiary"],
  },
  {
    id: "track",
    label: "分段控件轨道 / 未选中标签",
    layers: ["--glass-track"],
    backdrops: ["chrome"],
    tokens: ["--text-secondary", "--text-tertiary"],
  },
  {
    id: "raise",
    label: "选中分段 / 活动标签（抬起来的那一枚）",
    layers: ["--glass-raise-a", "--glass-raise-b"],
    backdrops: ["chrome"],
    tokens: ["--text-primary", "--text-secondary"],
  },
];

const T = 4.5;

/** 把一个表面名解析成「可能的底」列表；复合底（chrome）有两档止点，两档都要算 ——
    渐变上端浅、下端深，浅色文字怕浅底、深色文字怕深底，只挑一档必然漏一半。 */
function resolveBackdrops(tokens, name, depth = 0) {
  if (depth > 4) return [];
  if (name === "white") return [{ label: "纯白内容", rgb: WHITE }];
  if (name === "black") return [{ label: "纯黑内容", rgb: BLACK }];
  if (name.startsWith("scrim:")) {
    const scrim = parseColor(tokens.get("--scrim"));
    if (!scrim) return [];
    return resolveBackdrops(tokens, name.slice(6), depth + 1).map((b) => ({
      label: `遮罩叠${b.label}`,
      rgb: over(scrim, b.rgb),
    }));
  }
  if (name === "canvas") {
    const c = parseColor(tokens.get("--canvas"));
    if (!c) return [];
    return [{ label: "画布", rgb: c.a >= 1 ? c.rgb : over(c, WHITE) }];
  }
  if (name === "chrome") {
    const under = resolveBackdrops(tokens, "canvas", depth + 1)[0];
    if (!under) return [];
    const out = [];
    for (const tk of ["--glass-chrome-a", "--glass-chrome-b"]) {
      const c = parseColor(tokens.get(tk));
      if (c) out.push({ label: "工具条玻璃", rgb: over(c, under.rgb) });
    }
    return out;
  }
  return [];
}

function checkTheme(theme, tokens, opts = {}) {
  const failures = [];
  const rows = [];
  const weaken = opts.weaken ?? 0;

  for (const role of ROLES) {
    for (const bd of role.backdrops) {
      const backdrops = resolveBackdrops(tokens, bd);
      if (!backdrops.length) {
        failures.push(`${theme} ${role.id}：底 ${bd} 解析失败（令牌缺失？）`);
        continue;
      }
      for (const backdrop of backdrops) {
      /* 渐变两档各算一遍，取较差的那一档 */
      for (const layerToken of role.layers) {
        const raw = tokens.get(layerToken);
        if (!raw) {
          failures.push(`${theme} ${role.id}：缺令牌 ${layerToken}`);
          continue;
        }
        const layer = parseColor(raw);
        if (!layer) {
          failures.push(`${theme} ${role.id}：${layerToken} 不是可解析颜色（${raw}）`);
          continue;
        }
        // 负向对照：把 alpha 压低，模拟「为了好看把玻璃调薄」
        const eff = { rgb: layer.rgb, a: weaken ? Math.min(layer.a, weaken) : layer.a };
        const surface = over(eff, backdrop.rgb);

        for (const tk of role.tokens) {
          const fgRaw = tokens.get(tk);
          if (!fgRaw) {
            failures.push(`${theme} ${role.id}：缺文字令牌 ${tk}`);
            continue;
          }
          const fg = parseColor(fgRaw);
          if (!fg) {
            failures.push(`${theme} ${role.id}：文字令牌 ${tk} 不是可解析颜色（${fgRaw}）`);
            continue;
          }
          const text = over(fg, surface);
          const ratio = contrast(text, surface);
          const row = { role, layerToken, bd: backdrop.label, tk, ratio };
          rows.push(row);
          if (ratio < T) {
            failures.push(
              `${theme} ${role.label} · ${layerToken} on ${backdrop.label} · ${tk} = ` +
                `${ratio.toFixed(2)}:1（正文需 ${T}）`
            );
          }
        }
      }
      }
    }
  }
  return { failures, rows };
}

/* ---------- 主流程 ---------- */

const themes = { dark: merged("dark"), light: merged("light") };
let failures = 0;
const lines = [];

lines.push("=== 玻璃材质对比度判据 ===");
lines.push("（遮罩 + 玻璃 + 文字 逐层合成；底取纯白/纯黑两个极端）");

for (const theme of ["dark", "light"]) {
  const { failures: f, rows } = checkTheme(theme, themes[theme]);
  const name = theme === "dark" ? "深色档" : "浅色档";
  if (f.length) {
    failures += f.length;
    lines.push(`\n${name}：❌ ${f.length} 项不达标`);
    for (const m of f) lines.push("  ❌ " + m);
  } else {
    const worst = rows.reduce((a, b) => (a.ratio < b.ratio ? a : b));
    lines.push(
      `\n${name}：✅ ${rows.length} 项组合全过，最差 ${worst.ratio.toFixed(2)}:1` +
        `（${worst.role.label} · ${worst.tk} · ${worst.bd}）`
    );
  }
}

/* ---------- 正反对照：把玻璃调薄，判据必须变红 ---------- */

if (process.argv.includes("--selftest")) {
  const weak = { weakFailures: 0 };
  for (const theme of ["dark", "light"]) {
    const { failures: f } = checkTheme(theme, themes[theme], { weaken: 0.45 });
    weak.weakFailures += f.length;
  }
  lines.push(
    `\n正反对照：把玻璃 alpha 压到 0.45 → ${weak.weakFailures} 项告警` +
      (weak.weakFailures > 0 ? " ✅（判据有效）" : " ❌（判据失效：这么薄都判不出来）")
  );
  if (weak.weakFailures === 0) failures++;
}

console.log(lines.join("\n"));
console.log(failures === 0 ? `\n✅ PASS：0 项失败\n` : `\n❌ FAIL：${failures} 项失败\n`);
process.exit(failures === 0 ? 0 : 1);
