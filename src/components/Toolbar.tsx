import { memo } from "react";
import type { ViewMode } from "../types";

interface Props {
  viewMode: ViewMode;
  onToggleView: () => void;
  onToggleSidebar: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  modified: boolean;
  displayName: string;
  words: number;
  minutes: number;
  onToggleTheme: () => void;
  typewriterMode: boolean;
  onToggleTypewriter: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
  onFindReplace: () => void;
  onExportPdf: () => void;
  hasFrontmatter: boolean;
  frontmatterOpen: boolean;
  onToggleInfo: () => void;
}

export const Toolbar = memo(function Toolbar({
  viewMode,
  onToggleView,
  onToggleSidebar,
  onNew,
  onOpen,
  onSave,
  modified,
  displayName,
  words,
  minutes,
  onToggleTheme,
  typewriterMode,
  onToggleTypewriter,
  focusMode,
  onToggleFocus,
  onFindReplace,
  onExportPdf,
  hasFrontmatter,
  frontmatterOpen,
  onToggleInfo,
}: Props) {
  return (
    <header className="toolbar">
      <div className="toolbar-side">
        <button className="tbar-btn" onClick={onToggleSidebar} title="Sidebar (\)" aria-label="切换侧栏">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
            <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" />
          </svg>
        </button>
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">Rocktier<span className="tag">Markdown</span></span>
        </div>
        <div className={`doc-pill ${modified ? "modified" : ""}`}>
          {modified && <span className="dot" />}
          <span className="name">{displayName}</span>
        </div>
      </div>

      <div className="toolbar-center">
        <div className="view-switch">
          <button
            className={`tbar-btn ${viewMode === "editor" ? "active" : ""}`}
            disabled={viewMode === "editor"}
            onClick={onToggleView}
            title="Editor"
            aria-label="仅编辑"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              <rect x="1" y="1" width="12" height="12" rx="2" />
              <line x1="4" y1="4.5" x2="10" y2="4.5" strokeLinecap="round" />
              <line x1="4" y1="7" x2="8" y2="7" strokeLinecap="round" />
              <line x1="4" y1="9.5" x2="9" y2="9.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className={`tbar-btn ${viewMode === "split" ? "active" : ""}`}
            disabled={viewMode === "split"}
            onClick={onToggleView}
            title="Split"
            aria-label="分屏"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              <rect x="1" y="1" width="12" height="12" rx="2" />
              <line x1="7" y1="1" x2="7" y2="13" />
            </svg>
          </button>
          <button
            className={`tbar-btn ${viewMode === "preview" ? "active" : ""}`}
            disabled={viewMode === "preview"}
            onClick={onToggleView}
            title="Preview"
            aria-label="仅预览"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              <rect x="1" y="1" width="12" height="12" rx="2" />
              <polyline points="4.5,5 7,2.5 9.5,5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="7" y1="2.5" x2="7" y2="9" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="toolbar-actions">
        <button className="tbar-btn stat" title={`${words} words`} aria-label={`${words} 字 / ${minutes} 分钟阅读`}>
          <span className="stat-num">{words >= 1000 ? `${(words / 1000).toFixed(1)}k` : words}</span>
          <span className="stat-sep">/</span>
          <span className="stat-min">{minutes}m</span>
        </button>
        <button className="tbar-btn" onClick={onNew} title="New (⌘N)" aria-label="新建文档">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <line x1="7.5" y1="2" x2="7.5" y2="13" />
            <line x1="2" y1="7.5" x2="13" y2="7.5" />
          </svg>
        </button>
        <button className="tbar-btn" onClick={onOpen} title="Open (⌘O)" aria-label="打开文件">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M2 4h4l1.5 1.5H12a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          </svg>
        </button>
        <button
          className={`tbar-btn ${modified ? "has-action" : ""}`}
          onClick={onSave}
          title="Save (⌘S)"
          aria-label="保存"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M3 1v5h8V1M3 14v-4h9v4" />
            <path d="M1 6v8h13V6" />
          </svg>
        </button>
        <button
          className={`tbar-btn ${typewriterMode ? "active" : ""}`}
          onClick={onToggleTypewriter}
          title="Typewriter (⌘⇧T)"
          aria-label="打字机模式"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <line x1="2" y1="4" x2="13" y2="4" />
            <line x1="2" y1="7.5" x2="13" y2="7.5" strokeWidth="2" />
            <line x1="2" y1="11" x2="13" y2="11" />
          </svg>
        </button>
        <button
          className={`tbar-btn ${focusMode ? "active" : ""}`}
          onClick={onToggleFocus}
          title="Focus (⌘⇧F)"
          aria-label="聚焦模式"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="2.5" />
            <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button
          className="tbar-btn"
          onClick={onFindReplace}
          title="Find (⌘F)"
          aria-label="查找替换"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" />
          </svg>
        </button>
        <button
          className="tbar-btn"
          onClick={onExportPdf}
          title="Export PDF (⌘⇧P)"
          aria-label="导出 PDF"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <line x1="7.5" y1="2" x2="7.5" y2="9" />
            <polyline points="5,6.5 7.5,9 10,6.5" fill="none" />
            <line x1="3" y1="13" x2="12" y2="13" />
          </svg>
        </button>
        {hasFrontmatter && (
          <button
            className={`tbar-btn ${frontmatterOpen ? "active" : ""}`}
            onClick={onToggleInfo}
            title="Info"
            aria-label="文档信息"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
              <circle cx="7.5" cy="7.5" r="5.5" />
              <circle cx="7.5" cy="5" r="0.8" fill="currentColor" stroke="none" />
              <line x1="7.5" y1="7" x2="7.5" y2="11" />
            </svg>
          </button>
        )}
        <button className="tbar-btn theme-btn" onClick={onToggleTheme} title="Toggle theme" aria-label="切换日夜模式">
          <svg className="icon-sun" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="7" cy="7" r="3" />
            <line x1="7" y1="1" x2="7" y2="2.5" strokeLinecap="round" />
            <line x1="7" y1="11.5" x2="7" y2="13" strokeLinecap="round" />
            <line x1="1" y1="7" x2="2.5" y2="7" strokeLinecap="round" />
            <line x1="11.5" y1="7" x2="13" y2="7" strokeLinecap="round" />
            <line x1="2.8" y1="2.8" x2="3.9" y2="3.9" strokeLinecap="round" />
            <line x1="10.1" y1="10.1" x2="11.2" y2="11.2" strokeLinecap="round" />
            <line x1="2.8" y1="11.2" x2="3.9" y2="10.1" strokeLinecap="round" />
            <line x1="10.1" y1="3.9" x2="11.2" y2="2.8" strokeLinecap="round" />
          </svg>
          <svg className="icon-moon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M11 8.5A5 5 0 0 1 5.5 3a4.98 4.98 0 0 1 5.5 5.5z" />
            <path d="M7 1a6 6 0 0 0 6 6c0 3.31-2.69 6-6 6S1 10.31 1 7a6 6 0 0 2.5-4.87" />
          </svg>
        </button>
      </div>
    </header>
  );
});
