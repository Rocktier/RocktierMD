import { memo, useState } from "react";
import type { Heading } from "../services/markdown";
import { t, fmtKeys, useUiLang } from "../i18n";

interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  headings: Heading[];
  /** 每条大纲的密度（0–100，该节行数 / 最长节），与 headings 按下标对齐 */
  densities?: number[];
  onJumpTo: (line: number) => void;
  recent?: string[];
  onOpenRecent?: (path: string) => void;
  /** 当前文档路径：只用来给「最近打开」加 aria-current 高亮，没有就都不亮 */
  currentPath?: string | null;
}

/* 快捷键表统一写 macOS 字形，交给 fmtKeys 按平台转写 —— 此前自己拼
   "Ctrl" + "⇧"，Windows 上会出现 "Ctrl ⇧ S" 这种混排。 */

export const Sidebar = memo(function Sidebar({ open, onOpen, onClose, headings, densities, onJumpTo, recent = [], onOpenRecent, currentPath }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState("");
  useUiLang(); // 语言切换时重渲染

  /* 过滤时保住原下标：densities 与 headings 对齐，过滤后仍要取到正确那根 */
  const filtered = (filter
    ? headings
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => h.text.toLowerCase().includes(filter.toLowerCase()))
    : headings.map((h, i) => ({ h, i }))
  );

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label={t("sidebar.files")}>
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
          {/* 新建在顶栏，这里补「打开文件」：侧栏仍是文件入口，而不是只剩大纲 */}
          <button className="sidebar-item rail-open" onClick={onOpen}>
            <span className="icon">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path d="M2 3h3l1.4 1.3H10a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
              </svg>
            </span>
            {t("sidebar.openFile")}
          </button>

          {recent.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">{t("sidebar.recent")}</div>
              <div className="rail-recent">
                {recent.map((p) => {
                  const name = p.split(/[/\\]/).pop();
                  const current = !!currentPath && p === currentPath;
                  return (
                    <button
                      key={p}
                      className={`sidebar-item ${current ? "is-current" : ""}`}
                      onClick={() => onOpenRecent?.(p)}
                      title={p}
                      aria-current={current ? "true" : undefined}
                    >
                      <span className="icon">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                          <path d="M4 1.5h5l3 3v10H4zM9 1.5v3h3" />
                        </svg>
                      </span>
                      <span className="rail-name">{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 大纲区块常驻：无标题时给弱化占位，而不是整块消失让布局跳变 */}
          <div className="sidebar-section sidebar-section--outline">
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
                    {filtered.map(({ h, i }) => (
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
                        <span className="toc-text">{h.text}</span>
                        {/* 密度条（设计稿 07 签名元素）：长度=该节行数占比，纯真实数据 */}
                        {densities && (
                          <span className="density" aria-hidden="true">
                            <i style={{ width: `${densities[i] ?? 0}%` }} />
                          </span>
                        )}
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
              <div className="row"><span className="key">{fmtKeys("⌘ N")}</span><span className="desc">{t("sc.new")}</span></div>
              <div className="row"><span className="key">{fmtKeys("⌘ O")}</span><span className="desc">{t("sc.open")}</span></div>
              <div className="row"><span className="key">{fmtKeys("⌘ S")}</span><span className="desc">{t("sc.save")}</span></div>
              <div className="row"><span className="key">{fmtKeys("⌘ ⇧ S")}</span><span className="desc">{t("sc.saveAs")}</span></div>
              <div className="row"><span className="key">{fmtKeys("⌘ F")}</span><span className="desc">{t("sc.find")}</span></div>
              <div className="row"><span className="key">{fmtKeys("⌘ ⇧ P")}</span><span className="desc">{t("sc.exportPdf")}</span></div>
              <div className="row"><span className="key">{fmtKeys("⌘ \\")}</span><span className="desc">{t("sc.sidebar")}</span></div>
              <div className="row"><span className="key">Tab</span><span className="desc">{t("sc.indent")}</span></div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
});
