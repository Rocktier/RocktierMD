#!/usr/bin/env node
/* Rocktier Markdown · MAS 渠道静态判据
 *
 * 用法:
 *   node scripts/verify-mas-channel.mjs              主检查（真实仓）
 *   node scripts/verify-mas-channel.mjs --selftest   判据自身的正反对照
 *
 * 为什么需要它：
 *   「store 渠道无付费墙 + 无联网入口」这件事由五个文件共同决定，缺一份都不会
 *   在编译期报错，只会静默产出一个带自研试用墙、带检查更新菜单的商店包，
 *   到 ASC 审核才炸（3.1.1）。只数文件是否存在说明不了内容对不对，所以逐项
 *   读内容断言。
 *
 * 证据边界：本脚本是**静态**判据，只证明「源码与配置写对了」。它不证明
 *   CI 真的编出 universal .app、不证明描述文件身份三项注入成功、更不证明
 *   运行时零请求。那三件事分别要 CI run、build-appstore.sh sign 与抓包实测。
 *
 * 判据本身也要正反对照（findings D-108 / D-115）：--selftest 会在 /tmp 造一份
 *   只坏一处的副本，断言对应那一项判红、其余仍绿。判据写错时会在这里先红。
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  ".github/workflows/mas-package.yml",
  "scripts/build-appstore.sh",
  "src-tauri/tauri.appstore.conf.json",
  "src-tauri/Entitlements.appstore.plist",
  "src-tauri/src/lib.rs",
  "src-tauri/src/license.rs",
  "src/components/StatusBar.tsx",
  "src-tauri/Info.plist",
];

/* 家族仓在 Windows 上常是 CRLF：不归一会把 `}\r\n` 判成不匹配（假红）。 */
function read(root, rel) {
  const p = join(root, rel);
  return existsSync(p) ? readFileSync(p, "utf8").replace(/\r\n/g, "\n") : "";
}

function check(root) {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });

  const wf = read(root, ".github/workflows/mas-package.yml");
  add(
    "workflow",
    /workflow_dispatch/.test(wf) && /build-appstore\.sh pack/.test(wf) && /macos-latest/.test(wf),
    "MAS 出包工作流：手动触发 + 调 build-appstore.sh pack + macOS runner",
  );

  const sh = read(root, "scripts/build-appstore.sh");
  add(
    "channel-env",
    /export ROCKTIER_CHANNEL=store/.test(sh),
    "打包脚本无条件把渠道设死为 store（漏设会产出带墙的直发包）",
  );

  let conf = null;
  try { conf = JSON.parse(read(root, "src-tauri/tauri.appstore.conf.json")); } catch { /* 判红即可 */ }
  add(
    "appstore-conf",
    !!conf && Array.isArray(conf?.bundle?.targets) && conf.bundle.targets.includes("app") &&
      conf?.bundle?.macOS?.hardenedRuntime === false &&
      conf?.bundle?.macOS?.entitlements === "Entitlements.appstore.plist" &&
      conf?.bundle?.category === "Productivity",
    "MAS 配置：只产 .app / 关 hardenedRuntime / 指向沙箱 entitlements / 效率分类",
  );

  const ent = read(root, "src-tauri/Entitlements.appstore.plist");
  add(
    "sandbox",
    /<key>com\.apple\.security\.app-sandbox<\/key>\s*<true\/>/.test(ent) &&
      /com\.apple\.security\.files\.user-selected\.read-write/.test(ent) &&
      /com\.apple\.security\.network\.client/.test(ent),
    "沙箱 entitlements：app-sandbox + 用户选中文件可读写 + 出站能力",
  );

  const lib = read(root, "src-tauri/src/lib.rs");
  const help = lib.match(/let help_menu = if[\s\S]*?\n    \};/);
  const elsePart = help ? help[0].split(/else\s*\{/)[1] : "";
  add(
    "help-menu",
    !!help && /channel\(\) == "direct"/.test(help[0]) && !!elsePart &&
      !/\bupdate_i\b|\blicense_i\b/.test(elsePart) &&
      /\bsite_i\b/.test(elsePart) && /\bmail_i\b/.test(elsePart),
    "Help 菜单分渠道：store 版去掉检查更新与授权，保留官网与反馈",
  );

  const lic = read(root, "src-tauri/src/license.rs");
  add(
    "enforced",
    /ENFORCE && channel\(\) == "direct"/.test(lic),
    "写操作拦截只在 direct 渠道启用（store 版无自研付费墙）",
  );

  const sb = read(root, "src/components/StatusBar.tsx");
  add(
    "license-chip",
    /license\.channel === "direct"/.test(sb),
    "试用 / 过期胶囊只在 direct 渠道显示",
  );

  const info = read(root, "src-tauri/Info.plist");
  add(
    "export-compliance",
    /ITSAppUsesNonExemptEncryption/.test(info) && /<false\/>/.test(info) &&
      /public\.app-category\.productivity/.test(info),
    "出口合规声明为 false + 商店主类别为效率（MD 本地处理，无自研加密）",
  );

  return out;
}

/* 每条判据都要有「修复前应红」的对照：一次只破坏一处，且只允许那一处红。 */
const CASES = [
  { id: "workflow", file: ".github/workflows/mas-package.yml", from: "build-appstore.sh pack", to: "npm run build" },
  { id: "channel-env", file: "scripts/build-appstore.sh", from: "export ROCKTIER_CHANNEL=store", to: "export ROCKTIER_CHANNEL=direct" },
  { id: "appstore-conf", file: "src-tauri/tauri.appstore.conf.json", from: '"hardenedRuntime": false', to: '"hardenedRuntime": true' },
  { id: "sandbox", file: "src-tauri/Entitlements.appstore.plist", from: "com.apple.security.app-sandbox", to: "com.apple.security.cs.allow-jit" },
  { id: "help-menu", file: "src-tauri/src/lib.rs", from: "&[&site_i, &mail_i])?", to: "&[&update_i, &site_i, &mail_i])?" },
  { id: "enforced", file: "src-tauri/src/license.rs", from: 'ENFORCE && channel() == "direct"', to: "ENFORCE" },
  { id: "license-chip", file: "src/components/StatusBar.tsx", from: 'license.channel === "direct"', to: "true" },
  { id: "export-compliance", file: "src-tauri/Info.plist", from: "ITSAppUsesNonExemptEncryption", to: "ITSAppUsesExemptEncryption" },
];

function selftest() {
  let pass = 0;
  const failures = [];
  for (const c of CASES) {
    const tmp = mkdtempSync(join(tmpdir(), "md-mas-selftest-"));
    try {
      for (const rel of FILES) {
        const dest = join(tmp, rel);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, readFileSync(join(ROOT, rel)));
      }
      const target = join(tmp, c.file);
      const before = readFileSync(target, "utf8").replace(/\r\n/g, "\n");
      if (!before.includes(c.from)) {
        failures.push(`${c.id}: 对照样本里找不到 "${c.from}"，判据可能已失效`);
        continue;
      }
      writeFileSync(target, before.replace(c.from, c.to));
      const results = check(tmp);
      const red = results.filter((r) => !r.ok);
      if (red.length === 1 && red[0].id === c.id) pass++;
      else failures.push(`${c.id}: 期望只判红 ${c.id}，实得 [${red.map((r) => r.id).join(", ") || "全绿"}]`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  console.log(`\n  判据正反对照: ${pass}/${CASES.length} 通过`);
  for (const f of failures) console.log(`  ❌ ${f}`);
  return failures.length === 0 && pass === CASES.length;
}

const results = check(ROOT);
console.log("\n══════ Rocktier Markdown · MAS 渠道静态判据 ══════");
for (const r of results) console.log(`  ${r.ok ? "✅" : "❌"} ${r.id.padEnd(18)} ${r.detail}`);
const mainOk = results.every((r) => r.ok);
console.log(`\n  主检查: ${results.filter((r) => r.ok).length}/${results.length} 通过`);
console.log("  边界: 静态判据，不覆盖 CI 编译 / 签名注入 / 运行时抓包\n");
if (process.argv.includes("--selftest")) {
  const ok = selftest();
  process.exit(mainOk && ok ? 0 : 1);
}
process.exit(mainOk ? 0 : 1);
