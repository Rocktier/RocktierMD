import { memo, useState } from "react";
import type { Heading } from "../services/markdown";

interface Props {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  headings: Heading[];
  onJumpTo: (line: number) => void;
}

export const Sidebar = memo(function Sidebar({ open, onOpen, onClose, headings, onJumpTo }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? headings.filter((h) => h.text.toLowerCase().includes(filter.toLowerCase()))
    : headings;

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Files</span>
          <button className="sidebar-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>
        <div className="sidebar-body">
          <div className="sidebar-section">
            <h3>Actions</h3>
            <button className="sidebar-item" onClick={onOpen}>
              <span className="icon">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M2 3h3l1.4 1.3H10a1 1 0 0 1 1 1V10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                </svg>
              </span>
              Open File
            </button>
          </div>

          {headings.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-head">
                <h3>Outline</h3>
                <button
                  className="toc-collapse"
                  onClick={() => setCollapsed((c) => !c)}
                  aria-label={collapsed ? "Expand TOC" : "Collapse TOC"}
                >
                  {collapsed ? "+" : "−"}
                </button>
              </div>
              {!collapsed && (
                <>
                  <input
                    type="text"
                    className="toc-filter"
                    placeholder="Filter headings..."
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
              )}
            </div>
          )}

          <div className="sidebar-section">
            <h3>Shortcuts</h3>
            <div className="shortcuts">
              <div className="row"><span className="key">⌘ N</span><span className="desc">New</span></div>
              <div className="row"><span className="key">⌘ O</span><span className="desc">Open</span></div>
              <div className="row"><span className="key">⌘ S</span><span className="desc">Save</span></div>
              <div className="row"><span className="key">⌘ ⇧ S</span><span className="desc">Save as</span></div>
              <div className="row"><span className="key">⌘ F</span><span className="desc">Find</span></div>
              <div className="row"><span className="key">⌘ ⇧ P</span><span className="desc">Export PDF</span></div>
              <div className="row"><span className="key">⌘ \</span><span className="desc">Sidebar</span></div>
              <div className="row"><span className="key">Tab</span><span className="desc">Indent</span></div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
});
