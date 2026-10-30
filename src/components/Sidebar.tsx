import { memo, useState } from "react";
import type { Heading } from "../services/markdown";
import { t, useUiLang } from "../i18n";

interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  headings: Heading[];
  onJumpTo: (line: number) => void;
  recent?: string[];
  onOpenRecent?: (path: string) => void;
}

/** 快捷键表的修饰键：写死 ⌘ 会在 Windows/Linux 上与实际行为（Ctrl）对不上。 */
const MOD = /Mac/i.test(navigator.userAgent) ? "⌘" : "Ctrl";

export const Sidebar = memo(function Sidebar({ open, onOpen, onClose, headings, onJumpTo, recent = [], onOpenRecent }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState("");
  useUiLang(); // 语言切换时重渲染

  const filtered = filter
    ? headings.filter((h) => h.text.toLowerCase().includes(filter.toLowerCase()))
    : headings;

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">{t("sidebar.files")}</span>
          <button className="sidebar-close" onClick={onClose} aria-label={t("sidebar.close")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>
        <div className="sidebar-body">
          {/* 侧栏分区标题不用 h3：读屏的标题序列应从文档 h1 开始，
              侧栏小节名是界面标签不是文档结构（2026-10-25 审计 D-78）。 */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">{t("sidebar.actions")}</div>
            <button className="sidebar-item" onClick={onOpen}>
              <span className="icon">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M2 3h3l1.4 1.3H10a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                </svg>
              </span>
              {t("sidebar.openFile")}
            </button>
          </div>

          {recent.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">{t("sidebar.recent")}</div>
              {recent.map((p) => (
                <button
                  key={p}
                  className="sidebar-item"
                  onClick={() => onOpenRecent?.(p)}
                  title={p}
                >
                  <span className="icon">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                      <path d="M2 3h3l1.4 1.3H10a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                    </svg>
                  </span>
                  {p.split(/[/\\]/).pop()}
                </button>
              ))}
            </div>
          )}

          {/* 大纲区块常驻：无标题时给弱化占位，而不是整块消失让布局跳变 */}
          <div className="sidebar-section">
            <div className="sidebar-head">
              <div className="sidebar-section-title">{t("sidebar.outline")}</div>
              <button
                className="toc-collapse"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? t("sidebar.expandToc") : t("sidebar.collapseToc")}
              >
                {collapsed ? "+" : "−"}
              </button>
            </div>
            {!collapsed && (
              headings.length === 0 ? (
                <p className="toc-empty">{t("sidebar.outlineEmpty")}</p>
              ) : (
                <>
                  <input
                    type="text"
                    className="toc-filter"
                    placeholder={t("sidebar.filterHeadings")}
                    aria-label={t("sidebar.filterHeadings")}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <nav className="toc">
                    {filtered.map((h, i) => (
                      <button
                        key={i}
                        className={`toc-item level-${h.level}`}
                        onClick={() => {
                          onJumpTo(h.line);
                          if (h.id) {
                            document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
                          }
                        }}
                        title={h.text}
                      >
                        {h.text}
                      </button>
                    ))}
                  </nav>
                </>
              )
            )}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">{t("sidebar.shortcuts")}</div>
            <div className="shortcuts">
              <div className="row"><span className="key">{MOD} N</span><span className="desc">{t("sc.new")}</span></div>
              <div className="row"><span className="key">{MOD} O</span><span className="desc">{t("sc.open")}</span></div>
              <div className="row"><span className="key">{MOD} S</span><span className="desc">{t("sc.save")}</span></div>
              <div className="row"><span className="key">{MOD} ⇧ S</span><span className="desc">{t("sc.saveAs")}</span></div>
              <div className="row"><span className="key">{MOD} F</span><span className="desc">{t("sc.find")}</span></div>
              <div className="row"><span className="key">{MOD} ⇧ P</span><span className="desc">{t("sc.exportPdf")}</span></div>
              <div className="row"><span className="key">{MOD} \</span><span className="desc">{t("sc.sidebar")}</span></div>
              <div className="row"><span className="key">Tab</span><span className="desc">{t("sc.indent")}</span></div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
});
