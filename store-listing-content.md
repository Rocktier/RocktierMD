# Rocktier Markdown 1.0.0 — 微软商店提交资料

> 首次上架（不是更新）。本文是**唯一真源**，`~/Downloads/Rocktier-Markdown-MSStore/` 里的副本是工作用。
> 配套素材在 `store-assets/`。

---

## 0. 一句话现状

| 项 | 状态 |
|---|---|
| 应用包（MSIX） | ✅ 已产出并拆包核验（**2.0 MB**），见 §7 |
| 300×300 商店磁贴 | ✅ `store-assets/store-tile-300.png` |
| 截图 | ✅ 3 张 2560×1544（见 §6） |
| 文案 / 关键词 / 分类 / 分级 | ✅ 本文可逐项粘贴 |
| Partner Center 预留名 | ⚠️ 需确认是否为 `Rocktier.RocktierMarkdown`（见 §1） |

---

## 1. 身份与包标识（提交后不可更改）

| 字段 | 值 |
|---|---|
| 应用名（商店显示） | **Rocktier Markdown** |
| 包标识 `Identity/Name` | `Rocktier.RocktierMarkdown` |
| 发布者 `Identity/Publisher` | `CN=4EA39D7A-401B-4D56-98D0-8ECB1F2B8DF7` |
| 版本 `Identity/Version` | `1.0.0.0`（商店从包清单读取，不手填） |
| 架构 | x64 |
| 可执行文件 | `RocktierMarkdown.exe` |

⚠️ **先在 Partner Center 预留应用名**，且预留到的 Name 必须与上面完全一致；不一致就改 `src-tauri/tauri.conf.json` 的 `identifier` 重出包。
⚠️ `Identity/Name` 与 `Identity/Publisher` 一旦提交**不要再改**——改了会被商店当成另一个应用。

---

## 2. 定价与试用

| 字段 | 填写 |
|---|---|
| 定价 | **$4.99 USD 买断**（家族统一价） |
| 试用 | **不启用** |
| 为什么不用试用 | 商店的「限时试用」需要应用读取许可证状态才生效，而代码里**没有任何 license/trial 逻辑**。启用等于白送，且文案与实际行为矛盾。**纯买断是唯一诚实的选项。** |

---

## 3. 分类与标签

| 字段 | 填写 | 备注 |
|---|---|---|
| **类别** | **生产力（Productivity）** | Markdown 编辑器归这里最贴用户预期 |
| **子类别** | 在 Partner Center 实际下拉里选最接近「写作 / 笔记（Writing / Notes）」的一项 | 我这边拿不到该类别下的准确选项清单，**以界面为准**；若无可选项则留空 |
| **搜索关键词** | 见下 | |

### 搜索关键词（可直接粘贴）

```
markdown editor, markdown, markdown viewer, md editor, text editor, notes, writing app,
plain text, GFM, markdown preview, offline editor, markdown to html, markdown to pdf,
文本编辑器, markdown 编辑器, 写作
```

> **规则（家族踩坑 #16）：关键词里不得出现任何平台名或其他产品名**——不要写 Windows / macOS / iOS，也不要写 VS Code、Typora、Notion 之类。上面这组已自查通过。

---

## 4. 商店列表文案（可直接粘贴）

### 简短描述（≤100 字符，★必填）

```
Fast, tiny Markdown editor with live preview, GFM tables, math and PDF export — offline.
```

（92 字符 ✅。**刻意不含字面 "free"**——付费应用的描述里出现 "free" 是被拒的常见原因；"tiny" 是实测事实，见下方详细描述。）

### 详细描述

```
Rocktier Markdown is a focused writing app for people who want their notes to stay theirs.
It opens fast, works entirely offline, and never sends your documents anywhere.

WRITE AND SEE IT AT THE SAME TIME
Type on the left, watch it render on the right. The preview keeps up as you write —
no manual refresh, no two-pane juggling.

MARKDOWN THAT COVERS REAL DOCUMENTS
• GitHub Flavored Markdown: tables, task lists, strikethrough, autolinks
• Syntax highlighting for code blocks
• Math typeset with KaTeX ($inline$ and $$display$$)
• Front matter (YAML) recognised and shown in its own panel
• Tick task items straight from the preview

STAY ORIENTED IN LONG DOCUMENTS
A live outline lists every heading and jumps to it in one click. Word count and
reading time sit in the status bar, along with the current line and column.

FIND, REPLACE, EXPORT
Search with plain text or regular expressions, replace one or all. Export to HTML,
or print to PDF through the system dialog when you need to hand something over.

YOUR FILES, ORDINARY FILES
Everything is a plain .md file. Open them with any editor, any time, even if this
app disappears tomorrow. Recent documents are one click away, and drag-and-drop works.

BUILT FOR LONG SESSIONS
Dark and light themes, a distraction-free layout, and crash recovery that keeps an
unsaved draft for every document — including ones you never saved to disk at all.

SMALL, AND QUICK TO OPEN
The whole app is about 2 MB to install — that is the entire program, not a
downloader. There is no bundled browser engine (it uses the one Windows already
has), no background service, and nothing left running once you close the window.
It opens in well under a second, so it never gets between you and the sentence
you were about to write.

PRIVATE BY DESIGN
No account. No telemetry. No analytics. No network capability is declared in the
package manifest at all — the app cannot phone home even if it wanted to.

English and Chinese interface, switchable at any time.
```

### 此版本的新增功能（首次发布）

```
First release.

• Live side-by-side preview with GitHub Flavored Markdown
• Code syntax highlighting and KaTeX math
• Clickable outline for long documents
• Find & replace, plain text or regular expressions
• Task lists you can tick from the preview
• Export to HTML; print to PDF
• Front matter panel
• Dark and light themes
• Crash recovery for unsaved work, including never-saved documents
• English and Chinese interface
```

---

## 5. 商店信息字段

| 字段 | 填写 |
|---|---|
| 支持邮箱 | `hello@rocktier.com` |
| 支持 URL | `https://rocktier.com` |
| 官网 | `https://rocktier.com/markdown` |
| 隐私政策 URL | `https://rocktier.com/privacy` |
| 版权 | `© 2026 Rocktier` |
| 开发者/发布者显示名 | `Rocktier` |
| 是否含广告 | 否 |
| 是否含应用内购买 | 否 |
| 需要网络连接 | 否（纯离线） |
| 界面语言 | 英语、简体中文 |
| 最低系统要求 | Windows 10 版本 1809（build 17763）或更高 / Windows 11 · x64 |

---

## 6. 素材

### 已就绪

| 素材 | 文件 | 规格 |
|---|---|---|
| 商店磁贴 | `store-assets/store-tile-300.png` | 300×300，含透明通道 ✅ |

> 磁贴由 `src-tauri/icons/icon.svg` 直接栅格化（`rsvg-convert -w 300 -h 300`），与包内图标同源，不会漂移。

### 截图（2560×1544，家族统一规格）

| # | 文件 | 画面 |
|---|---|---|
| 1 | `store-assets/screenshot-1-editor.png` | 分栏编辑态（左源码 + 右渲染），浅色 |
| 2 | `store-assets/screenshot-2-code-math.png` | 代码高亮 + KaTeX 公式 + 表格，浅色 |
| 3 | `store-assets/screenshot-3-dark.png` | 同上画面，深色主题 |

配套示例文档：`store-assets/demo.md`、`store-assets/demo-code-math.md`（后者把代码/公式放在首屏，无需滚动）。

**拍摄方法**（可复现，供 1.0.1 重拍）：

```bash
# 1. 构建应用（本地 node_modules 需完整，否则 tauri CLI 不可用）
npm install && npm run tauri -- build --bundles app

# 2. 打开示例文档
open -a "<repo>/src-tauri/target/release/bundle/macos/Rocktier Markdown.app" \
     "<repo>/store-assets/demo.md"

# 3. 激活应用 + 固定窗口（MD 用隐藏标题栏，内容从窗口原点开始，所以 y 不加偏移）
osascript -e 'tell application "Rocktier Markdown" to activate'
osascript -e 'tell application "System Events" to tell process "Rocktier Markdown" to set frontmost to true'
osascript -e 'tell application "System Events" to tell process "Rocktier Markdown" to set position of window 1 to {20, 60}'
osascript -e 'tell application "System Events" to tell process "Rocktier Markdown" to set size of window 1 to {1280, 772}'

# 4. 截图（区域 = 窗口内容区，Retina 2x → 2560×1544）
screencapture -x -R20,60,1280,772 store-assets/screenshot-1-editor.png
```

**三条实战教训**：

- **必须先把应用激活并确认 `frontmost`，再截图**——否则抓到的是当前最前窗口（本机是 IDE），我已踩过两次。
- **不要试图用按键滚动或往搜索框打字**：按键会落进编辑区（实测把文档标题改成了 "Code, MaTable and Tables"）。要展示某段内容，就**另写一份把该段放在首屏的示例文档**。
- **侧栏不做截图**：它列出最近打开的文件，可能带出真实笔记路径，违反"不得出现个人内容"。
- 主题切换走菜单（`View > Toggle Theme`），比点工具栏图标可靠；深色下平均亮度 ≈ 11、浅色 ≈ 245，可用 `PIL` 一行自查（不必逐张看图）。

---

## 7. 应用包（MSIX）

CI 在推 `v*` 标签时产出 **DMG / MSI / NSIS / MSIX**，并且有 `checks` 前置任务先跑类型检查、单元测试、`cargo test` 与 `clippy`——**测试不过不出包**。

```bash
gh release download v1.0.0 -R Rocktier/RocktierMD -p "*.msix" -D ~/Downloads/Rocktier-Markdown-MSStore
```

手动重跑（不改版本）：

```bash
gh workflow run build.yml --ref main -f release_tag=v1.0.0
```

> ⚠️ 手动触发**必须填 `release_tag`**，否则会拿分支名去上传。

### 提交前自检

```bash
M=~/Downloads/Rocktier-Markdown-MSStore/*.msix
unzip -p "$M" AppxManifest.xml | grep -E 'Name=|Version=|Publisher=|Executable='
```

应输出：

```
Name="Rocktier.RocktierMarkdown"
Publisher="CN=4EA39D7A-401B-4D56-98D0-8ECB1F2B8DF7"
Version="1.0.0.0"
Executable="RocktierMarkdown.exe"
```

**已于 2026-09-17 拆包核验通过** ✅（`v1.0.0` 的 `Rocktier.Markdown_1.0.0.0_x64.msix`）：四项标识全部一致，包内只有 exe + 4 个徽标 + 清单，且**文件关联只声明一条**（`rocktiermarkdowndocument`，8 个扩展名，无重复——这正是第一次打包失败的原因）。

### 实测体积与速度（文案里的数字来源）

| 项 | 实测 |
|---|---|
| MSIX（商店下载） | **2.0 MB** |
| 安装后体积（exe） | 3.9 MB |
| macOS DMG / NSIS 安装器 | 2.2 MB / 1.7 MB |
| 冷启动到窗口出现 | **0.6 秒** |
| 主进程内存 | 约 75 MB（另用系统 WebView，不自带浏览器内核） |

---

## 8. 年龄分级（IARC 问卷）怎么填

Partner Center → 年龄分级 → 开始问卷调查。本项目是**纯离线写作工具**：无账号、无联网、无广告、无应用内购买、不收集数据 → **所有内容类问题一律选「否 / 无」**，会拿到各区域最低分级。

| 问卷问题（大意） | 选择 | 依据 |
|---|---|---|
| 内容类别 | 非游戏（实用工具 / 生产力） | 写作工具，不是游戏 |
| 暴力 / 血腥 | 否 | 无任何暴力内容 |
| 性 / 裸露 | 否 | — |
| 粗俗语言 | 否 | — |
| 烟酒毒品等受管物质 | 否 | — |
| 赌博（含模拟赌博） | 否 | — |
| 恐怖 / 惊吓 | 否 | — |
| 用户生成内容 / 社交 | 否 | 只编辑本地 `.md` 文件；无账号、无分享、无聊天 |
| 用户间交互 / 多人 | 否 | 无联网功能 |
| 位置共享 | 否 | 不读取位置 |
| 收集个人信息 | 否 | 不收集、不上传（与清单里**未声明任何网络能力**一致） |
| 应用内数字商品购买 | 否 | 应用内无购买流程；买断走商店渠道，不是 IAP |
| 广告 | 否 | 无广告、无第三方 SDK |
| 无限制网络访问 / 内置浏览器 | 否 | 纯离线；官网与反馈链接交给系统浏览器打开 |

**预期结果**：ESRB Everyone · PEGI 3 · USK 0 · CERO A · GRAC 全体 · ClassInd Livre · ACB G（各区域最低分级，可一遍通过）。

---

## 9. Notes for certification（给审核员的说明）

建议填写（英文，逐条对应他们可能的疑问）：

```
Rocktier Markdown is a fully offline Markdown editor. The package declares no network
capability at all — there is no telemetry, no analytics, no account and no updater.

How to test:
1. Launch the app. It opens with an empty document; type any Markdown on the left and
   the preview renders on the right.
2. File > Open (or drag a .md file onto the window) to open an existing document.
   A sample document is not bundled; any plain-text .md file works.
3. The interface language follows the system language and can be switched in Settings
   (English / Simplified Chinese).

Notes:
- No sign-in, licence key or purchase step is required to review the app.
- "Print to PDF" uses the standard Windows print dialog; choose "Microsoft Print to PDF".
- Documents are ordinary files on disk. Nothing is written outside the user's chosen
  location except the crash-recovery drafts, which live in the app's local data folder.
- The app bundles open-source components (MIT / BSD licensed); their notices are listed
  in the project repository.
```

---

## 10. 提交前总自检

- [ ] Partner Center 已预留应用名，且与 `Rocktier.RocktierMarkdown` **完全一致**
- [ ] MSIX 已从 Release 下载，且 `AppxManifest.xml` 里 Name / Publisher / Version 三项核对通过
- [ ] 描述里**零字面 "free"**（含 "distraction-free" 这类子串写法）
- [ ] 定价 $4.99 / **不启用试用**，且与描述里的说法一致
- [ ] 至少 1 张截图已上传（建议 4 张，2560×1544）
- [ ] 300×300 磁贴已上传（`store-assets/store-tile-300.png`）
- [ ] 关键词里无平台名、无其他产品名
- [ ] 隐私政策 URL 可访问：`https://rocktier.com/privacy`
- [ ] IARC 问卷全选「否」
- [ ] 提交后**不再改** `Identity/Name` 与 `Identity/Publisher`

---

## 11. 与上架相关的实现改动（供判断风险）

已修复的**数据丢失类**问题（均补了回归测试）：

| 问题 | 后果 |
|---|---|
| 保存是「先截断再写」 | 写盘中途失败会毁掉原文件 → 改为临时文件 + rename |
| 保存成功后不清恢复草稿 | 下次启动提示「恢复」的是**更旧**的草稿，一点就覆盖新内容 |
| 未命名文档的草稿只写不读 | 新建文档写一半崩溃 → 内容 100% 丢失 |
| CRLF 被静默改写 | Windows 上打开一次再保存，整份文件换行被改（Git 全文件 diff） |

平台/正确性修复：外链图片被 CSP 拦、嵌套列表转换重复子项、FindReplace 字面模式误展开 `$&`、
「能读隐藏目录却不能写」的权限矛盾、macOS 专属内边距套到 Windows、Windows 显示 ⌘ 而非 Ctrl+。

**未做（经确认排除在外）**：相对路径图片在预览里不显示（粘贴图片后预览裂图）→ 建议 1.0.1 处理，
不影响上架，影响体验。
