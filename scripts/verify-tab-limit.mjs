#!/usr/bin/env node
/* Rocktier Markdown · 标签上限提示判据
 *
 * 用法:
 *   node scripts/verify-tab-limit.mjs              主检查（真实仓）
 *   node scripts/verify-tab-limit.mjs --selftest   判据自身的正反对照
 *
 * 为什么需要它：
 *   `openInTab` 在标签达上限时返回 false 并弹 error toast（tabs.ts 的 limited
 *   分支），但**调用方如果不等这个返回值**继续往下走，就会把刚弹的错误提示
 *   覆盖成绿色成功提示：界面毫无变化、却告诉用户「New document」。v1.0.21
 *   实测就是这个现象（findings D-141 / T7），而且 4 个调用点全都没判。
 *
 *   这类 bug 的纯逻辑测试抓不到 —— openTab 的 limited 分支本身是对的，错的是
 *   「谁调它、有没有看回执」。所以判据盯的是调用点形态，不是函数行为。
 *
 * 证据边界：静态判据。它不能证明 toast 的配色/时长正确，也不能证明上限数值
 *   与产品意图一致，只保证「每个调用点都检查了返回值」。
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = "src/App.tsx";

/**
 * 扫描源码，返回「调用 openInTab 却没检查返回值」的位置。
 * 认可的两种形态：
 *   if (!openInTab(...)) ...
 *   const ok = openInTab(...);  ...  if (!ok) ...
 */
export function checkSource(src) {
  const lines = src.split("\n");
  const bad = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/openInTab\s*\(/.test(line)) continue;
    if (/const\s+openInTab\s*=/.test(line)) continue; // 定义本身
    const t = line.trim();

    if (/^if\s*\(\s*!openInTab\s*\(/.test(t)) continue;

    const m = /^(?:const|let)\s+(\w+)\s*=\s*openInTab\s*\(/.exec(t);
    if (m) {
      const name = m[1];
      const tail = lines.slice(i + 1, i + 10).join("\n");
      if (new RegExp(`if\\s*\\(\\s*!${name}\\b`).test(tail)) continue;
      bad.push({ line: i + 1, text: t, why: `赋值给 ${name} 后 9 行内没有 if (!${name})` });
      continue;
    }
    bad.push({ line: i + 1, text: t, why: "返回值未被检查，失败时仍会弹成功提示" });
  }
  return bad;
}

function selftest() {
  const cases = [
    { name: "裸调用（当前 bug 形态）→ 必须判红", src: `openInTab(a, b);\nshowToast(t("ok"), "success");`, expectBad: true },
    { name: "if (!openInTab(...)) → 必须判绿", src: `if (!openInTab(a, b)) return;\nshowToast(t("ok"), "success");`, expectBad: false },
    { name: "赋值并检查 → 必须判绿", src: `const ok = openInTab(a, b);\nif (!ok) return;\nshowToast(t("ok"), "success");`, expectBad: false },
    { name: "赋值却不检查 → 必须判红", src: `const ok = openInTab(a, b);\nshowToast(t("ok"), "success");`, expectBad: true },
    { name: "定义行不能被当成调用点", src: `const openInTab = useCallback((next, meta) => { return true; }, []);`, expectBad: false },
    // 真实 bug 的调用是多行写法，判据必须命中的是第一行
    { name: "多行调用的首行也要命中 → 必须判红", src: `openInTab(\n  { path: null, content: "" },\n  { eol: "\\n" },\n);\nshowToast(t("ok"), "success");`, expectBad: true },
    { name: "多行调用包在 if 里 → 必须判绿", src: `if (!openInTab(\n  { path: null },\n  { eol: "\\n" },\n)) return;\nshowToast(t("ok"), "success");`, expectBad: false },
  ];
  let pass = 0;
  const failures = [];
  for (const c of cases) {
    // 本判据不做语法解析：注释里出现调用字样同样会被判红。这是刻意的保守
    // 行为 —— 宁可让人改措辞，也不放过一个真调用点。
    const bad = checkSource(c.src);
    const isBad = bad.length > 0;
    if (isBad === c.expectBad) pass++;
    else failures.push(`${c.name}：期望${c.expectBad ? "红" : "绿"}，实得${isBad ? "红" : "绿"}`);
  }
  console.log(`\n  判据正反对照: ${pass}/${cases.length} 通过`);
  for (const f of failures) console.log(`  ❌ ${f}`);
  return failures.length === 0;
}

const src = readFileSync(join(ROOT, TARGET), "utf8");
const bad = checkSource(src);
console.log("\n══════ Rocktier Markdown · 标签上限提示判据 ══════");
if (bad.length === 0) {
  console.log(`  ✅ ${TARGET.padEnd(18)} 所有 openInTab 调用点都检查了返回值`);
} else {
  for (const b of bad) console.log(`  ❌ ${TARGET}:${b.line}  ${b.why}\n        ${b.text}`);
}
const mainOk = bad.length === 0;
console.log(`\n  主检查: ${mainOk ? "1/1" : "0/1"} 通过（调用点 ${bad.length} 处未判返回值）`);
console.log("  边界: 静态判据，不覆盖 toast 配色/时长与上限数值是否合理\n");
if (process.argv.includes("--selftest")) {
  const ok = selftest();
  process.exit(mainOk && ok ? 0 : 1);
}
process.exit(mainOk ? 0 : 1);
