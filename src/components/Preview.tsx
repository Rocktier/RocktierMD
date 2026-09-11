import { memo, useEffect, useRef, type RefObject } from "react";
import { slugify } from "../services/markdown";

interface Props {
  html: string;
  previewRef?: RefObject<HTMLDivElement>;
  onScroll?: () => void;
  onToggleTask?: (lineNumber: number, checked: boolean) => void;
  taskLines?: number[];
  onOpenDocument?: (path: string) => void;
}

// micromark does not emit heading ids, so apply them post-render using the
// same slugify as extractHeadings — this makes in-document anchor links work.
function applyHeadingIds(root: HTMLElement) {
  const used = new Set<string>();
  root
    .querySelectorAll(".md-viewer h1, .md-viewer h2, .md-viewer h3, .md-viewer h4, .md-viewer h5, .md-viewer h6")
    .forEach((h) => {
      let id = slugify(h.textContent || "");
      if (!id) id = "section";
      let unique = id;
      let n = 1;
      while (used.has(unique)) unique = `${id}-${n++}`;
      used.add(unique);
      h.id = unique;
    });
}

export const Preview = memo(function Preview({ html, previewRef, onScroll, onToggleTask, taskLines, onOpenDocument }: Props) {
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = previewRef || internalRef;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    applyHeadingIds(root);

    // Enable GFM task checkboxes (micromark renders them disabled so raw-HTML
    // checkboxes in the source stay inert) and mark ours for the delegate.
    const cbs = root.querySelectorAll<HTMLInputElement>('.md-viewer input[type="checkbox"][disabled]');
    cbs.forEach((cb) => {
      cb.disabled = false;
      cb.dataset.rocktierTask = "1";
    });

    // Single delegated click handler for anchor links (in-document + .md files)
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#")) {
        e.preventDefault();
        const target = root.querySelector(`#${CSS.escape(href.slice(1))}`);
        target?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      if (onOpenDocument && /\.(md|markdown)$/i.test(href) && !/^(https?:|mailto:)/.test(href)) {
        e.preventDefault();
        onOpenDocument(href);
      }
    };

    // Toggle events bubble — one delegated listener writes back to the source.
    const onCheckboxChange = (e: Event) => {
      const cb = e.target as HTMLInputElement;
      if (!onToggleTask || cb.type !== "checkbox" || !cb.dataset.rocktierTask) return;
      const bound = root.querySelectorAll<HTMLInputElement>("input[data-rocktier-task]");
      const idx = Array.prototype.indexOf.call(bound, cb);
      if (idx === -1) return;
      // 复审 F10：源文档里的原始 HTML checkbox 会挤占序号，导致
      // taskLines[idx] 与实际行错位。匹配不到行号时直接忽略，
      // 绝不猜行号误改别处。
      const line = taskLines?.[idx];
      if (!line) return;
      onToggleTask(line, cb.checked);
    };

    root.addEventListener("click", onClick);
    root.addEventListener("change", onCheckboxChange);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("change", onCheckboxChange);
    };
  }, [html, taskLines, onToggleTask, onOpenDocument]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="preview-pane">
      <div className="preview-scroll" ref={ref as React.Ref<HTMLDivElement>} onScroll={onScroll}>
        <div className="md-viewer" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
});
