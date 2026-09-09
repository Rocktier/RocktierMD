# Rocktier MD 全面验视报告

**日期**: 2026-09-09  
**范围**: `/Users/danglei/Documents/vibe coding/Rocktier MD` 全量代码  
**方法**: Ponytail 工作法（端到端数据流追踪） + 代码知识图谱分析  
**构建状态**: TypeScript 编译通过 · Vite 6.4.3 生产构建 628ms · Bundle 340KB / gzip 108KB

---

## 1. 架构总览

| 指标 | 值 |
|------|-----|
| 源文件 | 13 个（.ts/.tsx） |
| 总代码行 | ~1,125 行 |
| 前端 bundle（gzip） | 108 KB |
| 应用 .app | 11 MB |
| DMG（压缩） | 3.0 MB |
| 第三方依赖 | micromark, DOMPurify, highlight.js, Tauri 2 |

### 模块拓扑（来源：代码知识图谱，298 条边）

- **services/file.ts** — 文件 I/O、对话框、web fallback（19 节点）
- **services/markdown.ts** — 解析、高亮、标题提取、任务行号、字数（核心）
- **hooks/useScrollSync.ts** — 滚动同步（时间锁防回馈）
- **hooks/useKeyboardShortcuts.ts** — 全局快捷键
- **hooks/useTheme.ts** — 主题持久化
- **components/Toolbar** / **Editor** / **Preview** / **Sidebar** — UI
- **App.tsx** — 总调度（98 条出边，组件根节点，职责合理）

---

## 2. Ponytail 工作法：端到端数据流验视

### 2.1 输入 → 渲染路径
**键盘输入** → `Editor.onInput` → `onChange(content)` → `setDoc` → React 重渲染 → `useDeferredContent`（避免打字卡顿） → `useMemo(parseMarkdown)` → `Preview` 渲染  
✓ 延迟解析方案正确，大文档不卡输入。

### 2.2 任务 Checkbox 逆向写入
**用户点击预览区 checkbox** → `Preview.useEffect` listener → `onToggleTask(lineNumber, checked)`（1-based 源行号） → `toggleTask` 直接定位 `lines[lineNumber - 1]` → `setDoc` → 更新 `Editor` value → React 重置光标 → `requestAnimationFrame` 恢复选区  
✓ 不再有索引漂移。修复有效。

### 2.3 文件打开
**用户点击 ⌘O** → `useKeyboardShortcuts` → `doOpen` → `confirmDiscard`（未保存警告） → Tauri `dialogOpen` → `exists` 校验 → `readTextFile` → `setDoc` + `rememberPath(localStorage)` + `showToast`  
✓ 数据流完整，异常处理覆盖（文件读取失败不崩溃）。

### 2.4 文件保存（首次）
**用户点击 ⌘S（无路径）** → `doSave` → `saveFileAs` → Tauri `dialogSave` → `writeTextFile` → 更新 path + modified=false + `rememberPath` + toast  
✓ 幂等；异常路径弹"保存失败"toast。

### 2.5 关闭窗口保护
**用户点红色关闭按钮** → Rust `CloseRequested` → `api.prevent_close()` → emit `app-close-requested` → 前端 `getCurrentWindow().listen` → `confirmDiscard` → 用户确认则 `invoke("force_close")`  
✓ 双向链路完整，前端可拦截关闭。

### 2.6 启动恢复
**应用启动** → `localStorage.getItem(LAST_PATH_KEY)` → `exists` 校验文件存在 → `readTextFile` → `setDoc`  
✓ 文件已移动或权限丢失时静默回退到 WELCOME_DOCUMENT，不崩溃。

### 2.7 主题切换
**点击主题按钮** → `toggleTheme()` → 读取当前主题 → 翻转 → 写入 `localStorage` + 设置 `data-theme` 属性  
✓ useTheme hook 首次渲染时从 storage 恢复；监听系统主题变化（system 模式下）。

### 2.8 滚动同步
**用户滚动编辑器** → `onEditorScroll` → `useScrollSync.sync("editor")` → 计算 ratio → 设置 `preview.scrollTop`  
✓ 时间锁（60ms `Date.now() 比较`）避免回馈循环，无 timer 泄漏。

---

## 3. 问题与改进建议

### 3.1 🔴 类型重复（中优先级，建议修）

App.tsx:18 定义 `DocState`，其形状与 `types/index.ts` 中已导出的 `MarkdownDocument` 完全一致（`path / content / modified`）。

```ts
// App.tsx:18 — 可删除
interface DocState {
  path: string | null;
  content: string;
  modified: boolean;
}
```

**建议**：`import type { MarkdownDocument }`，`setState<MarkdownDocument>`。消除重复，DRY。

### 3.2 🟡 Web fallback 死代码未分离（低优先级，可选）

`file.ts:83–134` 的 `openFileWeb / saveFileWeb / saveFileAsWeb / triggerDownload` 在 Tauri 产品中为死代码（注释也确认了这一点）。保留理由：`npm run dev` 无 Tauri shell 时仍可工作。

**建议**：如果不在意 dev-mode 的浏览器体验，可以删除（减 ~50 行 / ~1.5KB gzip）。如果保留现状也没问题。

### 3.3 🟡 Save 按钮 SVG 缺 `aria-hidden`（低优先级，无障碍）

`Toolbar.tsx:117–120` 保存按钮的两条 `<path>` 没有包裹在 `aria-hidden="true"` 内（所有其他按钮的 SVG 都加了）。

### 3.4 🟡 `saveFileAsWeb` 返回类型可统一（极低优先级）

`saveFileWeb` 返回 `void`，Tauri 路径返回 `Promise<void>`；`saveFileAsWeb` 返回 `Promise<string | null>` 但 Promise 内永远 resolve 非 null。不影响运行。

### 3.5 🟢 `confirmDialog` Tauri branch `kind: "warning"`（提示级别）

Tauri `ask()` 的 kind 设为 "warning"，但 `ask` 本身是 yes/no 确认框，语义是"提问"。应改为 `kind: "info"` 更准确；或直接用 `window.confirm` 的一致性对话框。轻微，不影响。

---

## 4. 安全验视

| 项 | 状态 |
|----|------|
| XSS 防御 | DOMPurify sanitize + CSP `script-src 'self'` |
| 危险 HTML | `allowDangerousHTML: true` + DOMPurify 双重过滤 |
| 危险协议 | `allowDangerousProtocol: false` 已禁用 |
| Tauri capabilities | 仅 window / dialog / fs.read-write-exists，无网络 / shell |
| localStorage key | 固定键名 `rocktier-md-last-path` / `rocktier-md-theme`，无用户控制输入 |
| 文件路径 | Tauri 对话框传回，未直接拼接或暴露 |
| CSP | 严格，禁止 `connect-src`（除 self）、禁止 `object/frame-src` |

✓ 安全姿态良好，无已知漏洞。

---

## 5. 性能验视

| 项 | 状态 |
|----|------|
| 首屏渲染 | 文本 + 内联单文件 bundle，无外部请求 |
| 大文档打字 | `useDeferredValue` 延迟解析，输入不阻塞 |
| 滚动同步 | 时间锁（比较 `Date.now()`），无 timer 堆叠 |
| 高亮 | 5 语言核心集（~80KB vs 完整 ~350KB）；超大代码块跳过 auto-detect |
| Bundle gzip | 108 KB |
| React 重渲染 | App.tsx 中 `useMemo` 缓存 html/headings/taskLines/words；`useCallback` 稳定子组件 props |

✓ 零性能瓶颈。所有已知优化位已经做满。

---

## 6. 代码知识图谱健康评分

基于 46 节点 / 298 边的图谱分析：

| 维度 | 评分 | 备注 |
|------|------|------|
| 模块内聚度 | B | services-file 0.133（可接受，文件 I/O + web fallback 天然外联） |
| 耦合度 | A | 跨社区边 13 条，App.tsx 为唯一根枢纽，方向清晰 |
| 核心节点 | A | App/parseMarkdown/openFile 是 hub，承担合理 |
| 圈复杂度 | A | 最大函数 toggleTask 约 15 行，整体扁平 |
| 扇入扇出平衡 | B+ | App.tsx 出度 98 略高，但作为根组件合理 |

---

## 7. 总结

**Rocktier MD 当前状态：生产可用。**

没有发现任何会阻止用户使用或导致数据丢失的 bug。已有的 5A–E 优化（任务行号、语言精简、启动恢复、无障碍、中文阅读速度）全部正确落地。前端 1125 行代码构成了一个干净、可维护、极致轻量的 Tauri Markdown 阅读器。

**建议修复顺序：**
1. 类型重复（DocState → MarkdownDocument） — 5 分钟
2. Save 按钮 SVG `aria-hidden` — 2 分钟
3. web fallback 路径取舍（保留或拆文件）— 依用户决定
4. confirmDialog `kind` 修正 — 可选

以上均为小修，**不影响发布**。现有 3.0MB DMG 可直接作为 v0.1.0 正式版交付。
