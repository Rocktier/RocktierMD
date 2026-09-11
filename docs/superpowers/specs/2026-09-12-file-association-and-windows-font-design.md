# Rocktier Markdown — 文件关联 + Windows 字体修复

日期：2026-09-12
范围：两个独立缺陷的修复，不包含重构。

---

## 1. 问题一：无法将应用设为 Markdown 默认打开程序

### 现象
双击 `.md` 文件不会打开内容；应用本体里「打开」选文档则正常。

### 根因
| # | 位置 | 问题 |
|---|---|---|
| 1 | `src-tauri/tauri.conf.json` → `bundle` | 完全没有 `fileAssociations`，安装包从不向 Windows 注册 `.md` 关联，系统「打开方式」里根本没有这个应用 |
| 2 | `src-tauri/src/lib.rs` → `run()` | 从不读取命令行参数。即使关联成功，双击也只是启动应用并走「恢复上次文档」逻辑，显示的不是被双击的文件 |

### 已核实的机制
- Tauri 的 NSIS 模板（`crates/tauri-bundler/.../nsis/installer.nsi`）对每个关联扩展名插入：

  ```nsis
  !insertmacro APP_ASSOCIATE "<ext>" "<name>" "<description>" "$INSTDIR\${MAINBINARYNAME}.exe,0" \
      "Open with ${PRODUCTNAME}" "$INSTDIR\${MAINBINARYNAME}.exe $\"%1$\""
  ```

  即注册表 `HKCR\<name>\shell\open\command` = `"…\Rocktier Markdown.exe" "%1"`。
  **结论：Windows 下双击的路径以 `argv[1]` 传入。** ProgID 由配置里的 `name` 字段决定。
- `tauri::RunEvent::Opened { urls }` 在 tauri 2.11.5 中被
  `#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]` 门控，
  在 Windows 上**不存在**，必须 `cfg` 隔离。macOS 的文件关联不走 argv，走这个事件。
- `bundle.windows.nsis.installMode` 默认 `currentUser`，注册表落在 `HKCU\Software\Classes`。

### 方案
1. `tauri.conf.json` 增加 `bundle.fileAssociations`，覆盖 Markdown 家族扩展名
   （`md / markdown / mdown / mkd / mkdn / mdwn / mdtxt / mdtext`）。
   **不纳入 `txt` / `text`**：会抢走记事本等既有 .txt 关联，且 `description` 会污染资源管理器「类型」列。
2. Rust 侧新增：
   - `InitialFile(Mutex<Option<String>>)` 状态，缓冲「启动时要打开的文档」。
   - `file_from_args()`：扫描 `argv`，取第一个存在且扩展名合法的文件（Windows / Linux）。
   - `initial_file()` 命令：前端挂载后拉取一次（**不 take，只 clone**，因为 React StrictMode 会双调用 effect）。
   - `RunEvent::Opened` 分支（macOS/iOS，`cfg` 隔离）：写入状态 **并** `emit("open-file", path)`，
     兼顾「冷启动早于前端挂载」和「应用已在运行时再次双击」两种时序。
3. 前端 `App.tsx`：
   - 启动恢复文档时，`initial_file()` 的返回值优先于 `localStorage` 里的上次路径；
     若启动文件读不到，回退到上次路径，不破坏原有零点击恢复体验。
   - 新增 `open-file` 监听，复用既有的 `openMarkdownPath()`。

### 为什么用户仍需手动点一次「始终使用」
Windows 8+ 出于安全不允许程序静默把自己设为默认应用。安装时注册关联后，应用会出现在
「打开方式 → 选择其他应用」中，由用户确认一次即可。

### 已评估但本阶段不做的项
- **单实例复用窗口**（`tauri-plugin-single-instance`）：当前 `localStorage` 的上次路径与
  恢复草稿逻辑是单窗口假设，多开会互相覆盖。本次按最小范围不做。
- **NSIS `installerHooks` 补写 `OpenWithProgids`**：Tauri 的 `APP_ASSOCIATE` 只把
  `HKCR\.md` 默认值指向我们的 ProgID，不写 `HKCR\.md\OpenWithProgids`。
  若实测发现应用不出现在「打开方式」列表，则补一个 `.nsh`：

  ```nsis
  !macro NSIS_HOOK_POSTINSTALL
    WriteRegStr SHCTX "Software\Classes\.md\OpenWithProgids" "Rocktier Markdown Document" ""
  !macroend
  ```

  并在 `bundle.windows.nsis.installerHooks` 指向它。**先按标准注册走，实测不通过再加。**
- **应用内「设为默认」入口**：不做。

### 构建与验证结果（2026-09-12 实测）

`tauri build` 成功（release + LTO 2m14s），产出：

| 产物 | 体积 | 是否注册文件关联 |
|---|---|---|
| `Rocktier Markdown_0.1.0_x64-setup.exe`（NSIS） | 1.61 MB | **是** |
| `Rocktier Markdown_0.1.0_x64_en-US.msi`（WiX） | 2.14 MB | **否** |

> ⚠️ **安装必须用 `-setup.exe`。** 已核对生成的 `target/release/wix/x64/main.wxs`，
> 里面**没有任何**关联注册条目——WiX/MSI 路径不会写 `HKCR`。这是实测结论，不是推测。

已核对生成的 `target/release/nsis/x64/installer.nsi`，8 个扩展名全部按配置生成：

```nsis
!insertmacro APP_ASSOCIATE "md" "Rocktier Markdown Document" "Markdown Document" \
    "$INSTDIR\${MAINBINARYNAME}.exe,0" "Open with ${PRODUCTNAME}" \
    "$INSTDIR\${MAINBINARYNAME}.exe $\"%1$\""
; …markdown / mdown / mkd / mkdn / mdwn / mdtxt / mdtext 同构
```

即注册表 `HKCR\Rocktier Markdown Document\shell\open\command` = `"…\Rocktier Markdown.exe" "%1"`。

### 安装后仍需人工确认的步骤
1. 用 `-setup.exe` 安装。若机器上已装过旧的 MSI 版本，安装器会先提示卸载（NSIS 模板带
   `PageReinstall` 的 WiX 检测）。
2. 右键任意 `.md` → 打开方式 → 选择其他应用，确认列表里有 Rocktier Markdown，
   勾选「始终使用此应用」。Windows 8+ 不允许程序静默抢占默认应用，这一步必须人工点。
3. 双击 `.md` 应直接加载该文件（而不是上次文档/欢迎页）。
4. 命令行回归：`"…\Rocktier Markdown.exe" "D:\some\doc.md"`。

### 若「打开方式」里仍看不到该应用
则说明需要补 `OpenWithProgids`（见上一节预留的 `.nsh` 钩子方案）。

---

## 2. 问题二：Windows 下正文阅读性差（字体回退）

### 根因
`src/styles/tokens.css` 的三条字体栈都是 macOS 优先、Windows 兜底错误：

| 变量 | 原定义 | Windows 实际落到 | macOS 实际落到 |
|---|---|---|---|
| `--font-serif` | `"New York", "Songti SC", Georgia, serif` | Georgia 拉丁 + **宋体(SimSun)** 中文 | New York + Songti SC ✅ |
| `--font-mono` | `"SF Mono", "JetBrains Mono", "Fira Code", Menlo, ui-monospace, monospace` | Consolas 拉丁（无 CJK）→ **宋体** | Menlo / SF Mono → 中文走不可控级联 |
| `--font-sans` | `… "Segoe UI" … "Microsoft YaHei" …` | Segoe UI + 微软雅黑 ✅ | SF Pro + PingFang SC ✅ |

预览正文用 `var(--font-serif)`，编辑器用 `var(--font-mono)`，所以**只有正文和编辑器难看**，
UI 壳子正常——与截图一致。

**关键判断：衬线正文只在 Windows 上是 bug，在 macOS 上是 feature。**
Songti SC 是高质量宋体、Retina 下 15px 清晰；Windows 的 SimSun 笔画发虚。
因此不做「一刀切改无衬线」，改用**单栈自适应**：同一份 CSS 里把两端各自的高质量字体
写进同一条栈，由字体是否存在自然分流，无需平台探测。

### 方案
```css
--font-serif:
  "New York", "New York Small",                 /* macOS 10.15+ 显示衬线 */
  "Songti SC",                                  /* macOS 中文：宋体-简 */
  "Source Han Serif SC", "Noto Serif CJK SC",   /* Windows/设计机可选思源宋体 */
  Georgia, "Times New Roman",                   /* 拉丁兜底 */
  "Microsoft YaHei UI", "Microsoft YaHei",      /* Windows 中文兜底：雅黑，而非宋体 */
  "PingFang SC", system-ui, sans-serif;

--font-mono:
  ui-monospace, "SF Mono", "Cascadia Mono", "Cascadia Code",   /* 系统等宽 */
  Consolas, "JetBrains Mono", "Fira Code", Menlo,              /* 跨平台等宽 */
  "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei",      /* 代码内中文，两端确定 */
  monospace;
```

- macOS：serif 仍是 New York + Songti SC（**零视觉回归**）；mono 由「Menlo + 不可控级联」
  变为「SF Mono/Menlo + PingFang SC」，更稳定，且更贴近原设计意图（原栈就把 `SF Mono` 排在首位）。
- Windows：serif 变 Georgia + 微软雅黑，mono 变 Cascadia Mono/Consolas + 微软雅黑，
  **两端都不再出现宋体**。

不打包中文字体、不改字号，保持安装包体积与现有排版。

---

## 影响文件
| 文件 | 变更 |
|---|---|
| `src-tauri/tauri.conf.json` | 新增 `bundle.fileAssociations` |
| `src-tauri/src/lib.rs` | `InitialFile` 状态、`file_from_args` / `is_markdown_path`、`initial_file` 命令、`build()` + `run(callback)` 改造、macOS `RunEvent::Opened` |
| `src/App.tsx` | 启动恢复优先用 `initial_file()`；新增 `open-file` 监听 |
| `src/styles/tokens.css` | `--font-serif` / `--font-mono` 两条栈 |

无新增依赖。macOS 侧行为变化仅限「原本完全没有的文件关联」被补上。
