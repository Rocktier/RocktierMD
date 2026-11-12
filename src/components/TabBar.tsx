// 标签栏。只在有两张以上标签时出现 —— 单文档时它是纯噪音，
// 而「新建」入口本来就在工具栏上。
//
// 交互与浏览器一致：点标题切换、× 关闭、中键关闭、双击未命名标签不做事。
// 关掉改过的标签会先问一句（由父组件的 doCloseTab 负责），这里不重复实现。

import { t } from "../i18n";
import { tabLabel, type DocumentTab } from "../services/tabs";

interface Props {
  tabs: DocumentTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export function TabBar({ tabs, activeId, onSelect, onClose, onNew }: Props) {
  if (tabs.length < 2) return null;

  return (
    <div className="tabbar" role="tablist" aria-label={t("tab.list")}>
      <div className="tabbar-strip">
        {tabs.map((tab) => {
          const label = tabLabel(tab, t("doc.untitled"));
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={active ? "tab tab--active" : "tab"}
              title={tab.doc.path || label}
              onClick={() => onSelect(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  onClose(tab.id);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(tab.id);
                }
              }}
            >
              <span className="tab-label">{label}</span>
              {tab.doc.modified && <span className="tab-dot" aria-label={t("tab.unsaved")} />}
              <button
                type="button"
                className="tab-close"
                aria-label={t("tab.close", { name: label })}
                onClick={(e) => {
                  // 不冒泡：否则点 × 会先切到这张标签再关掉，视觉上闪一下
                  e.stopPropagation();
                  onClose(tab.id);
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
                  <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" />
                  <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" className="tabbar-new" onClick={onNew} aria-label={t("tab.new")} title={t("tab.new")}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <line x1="6" y1="2" x2="6" y2="10" />
          <line x1="2" y1="6" x2="10" y2="6" />
        </svg>
      </button>
    </div>
  );
}
