import { memo } from "react";
import type { ViewMode } from "../types";
import { t, useUiLang } from "../i18n";

interface Props {
  viewMode: ViewMode;
  /** 分段控件语义：点哪项即切到该态（不再用 disabled 表达"选中"） */
  onSelectView: (v: ViewMode) => void;
  onToggleSidebar: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  modified: boolean;
  /** 是否已落到磁盘：决定名字后面说「已保存」还是什么都不说 */
  hasPath: boolean;
  displayName: string;
  themeMode: "auto" | "light" | "dark";
  onToggleTheme: () => void;
  onFindReplace: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  hasFrontmatter: boolean;
  frontmatterOpen: boolean;
  onToggleInfo: () => void;
}

export const Toolbar = memo(function Toolbar({
  viewMode,
  onSelectView,
  onToggleSidebar,
  onNew,
  onOpen,
  onSave,
  modified,
  hasPath,
  displayName,
  themeMode,
  onToggleTheme,
  onFindReplace,
  onExportPdf,
  onExportHtml,
  hasFrontmatter,
  frontmatterOpen,
  onToggleInfo,
}: Props) {
  useUiLang(); // 语言切换时重渲染
  /* 状态只由真实状态驱动：有未保存改动才亮呼吸点，且旁边一定有文字。
     静止态（无改动）只留名字，不放任何红点。 */
  const docState = modified ? t("doc.unsaved") : hasPath ? t("doc.saved") : "";
  return (
    <header className="toolbar">
      <div className="toolbar-side">
        <button className="tbar-btn" onClick={onToggleSidebar} title={t("toolbar.toggleSidebar")} aria-label={t("toolbar.toggleSidebar")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
            <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" />
          </svg>
        </button>
        <div className="brand">
          <img className="brand-mark" src="/favicon.png" alt="" />
          <span className="brand-name">Rocktier<span className="tag">Markdown</span></span>
          <span className="brand-tagline">{t("brand.tagline")}</span>
        </div>
        <div
          className={`doc-pill ${modified ? "is-unsaved" : ""}`}
          title={modified ? t("toolbar.unsaved") : displayName}
        >
          {modified && <span className="dot-live" role="img" aria-label={docState} />}
          <span className="name">{displayName}</span>
          {docState && <span className="state">{docState}</span>}
        </div>
      </div>

      <div className="toolbar-center">
        {/* 分段控件用和面板里一样的词：仅编辑 / 分屏 / 仅预览。
            aria-pressed 表达选中，视觉上是实底反白，不靠颜色单独编码。 */}
        <div className="view-switch" role="group" aria-label={t("toolbar.viewGroup")}>
          <button
            className="seg-btn"
            aria-pressed={viewMode === "editor"}
            onClick={() => onSelectView("editor")}
            title={t("toolbar.editorOnly")}
          >
            {t("toolbar.editorOnly")}
          </button>
          <button
            className="seg-btn"
            aria-pressed={viewMode === "split"}
            onClick={() => onSelectView("split")}
            title={t("toolbar.split")}
          >
            {t("toolbar.split")}
          </button>
          <button
            className="seg-btn"
            aria-pressed={viewMode === "preview"}
            onClick={() => onSelectView("preview")}
            title={t("toolbar.previewOnly")}
          >
            {t("toolbar.previewOnly")}
          </button>
        </div>
      </div>

      <div className="toolbar-actions">
        <button className="tbar-btn" onClick={onNew} title={t("toolbar.new")} aria-label={t("toolbar.new")}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <line x1="7.5" y1="2" x2="7.5" y2="13" />
            <line x1="2" y1="7.5" x2="13" y2="7.5" />
          </svg>
        </button>
        <button className="tbar-btn" onClick={onOpen} title={t("toolbar.open")} aria-label={t("toolbar.open")}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M2 4h4l1.5 1.5H12a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          </svg>
        </button>
        {/* 未保存态已由名字旁「未保存」承载；这里不再加裸红点，避免红点单独编码状态 */}
        <button className="tbar-btn" onClick={onSave} title={t("toolbar.save")} aria-label={t("toolbar.save")}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M3 1v5h8V1M3 14v-4h9v4" />
            <path d="M1 6v8h13V6" />
          </svg>
        </button>
        <button
          className="tbar-btn"
          onClick={onFindReplace}
          title={t("toolbar.find")}
          aria-label={t("toolbar.find")}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" />
          </svg>
        </button>
        {hasFrontmatter && (
          <button
            className={`tbar-btn ${frontmatterOpen ? "active" : ""}`}
            onClick={onToggleInfo}
            title={t("toolbar.info")}
            aria-label={t("toolbar.info")}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
              <circle cx="7.5" cy="7.5" r="5.5" />
              <circle cx="7.5" cy="5" r="0.8" fill="currentColor" stroke="none" />
              <line x1="7.5" y1="7" x2="7.5" y2="11" />
            </svg>
          </button>
        )}
        {/* 家族唯一主题按钮：.icon-btn（28×28 + 40px 命中区）。
            三态 auto → light → dark，data-mode 驱动角标，title/aria-label 说明当前档。 */}
        <button
          className="icon-btn"
          data-mode={themeMode}
          onClick={onToggleTheme}
          title={`${t("toolbar.theme")} \u00b7 ${t(`theme.mode.${themeMode}`)}`}
          aria-label={`${t("toolbar.theme")}: ${t(`theme.mode.${themeMode}`)}`}
        >
          {themeMode === "auto" ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2.5" y="4" width="19" height="13" rx="2" />
              <path d="M8 20.5h8M12 17v3.5" />
            </svg>
          ) : themeMode === "dark" ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
            </svg>
          )}
        </button>
        {/* 主操作是导出 PDF，图标级的 HTML 导出与它并列：两者都是「把文档
            交给别人」，不抢主按钮的视线，但也不该藏进二级菜单里。 */}
        <button className="tbar-btn" onClick={onExportHtml} title={t("toolbar.exportHtml")} aria-label={t("toolbar.exportHtml")}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 1.5h6l3 3v9h-9z" />
            <path d="M9.5 1.5v3h3" />
            <path d="M6.5 7.5 5.5 9l1 1.5M8.5 7.5 9.5 9l-1 1.5" />
          </svg>
        </button>
        <button className="export-btn" onClick={onExportPdf} title={t("toolbar.exportPdf")}>
          {t("toolbar.export")}
        </button>
      </div>
    </header>
  );
});
