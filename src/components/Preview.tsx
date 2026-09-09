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
    const el = ref.current;
    if (!el) return;

    applyHeadingIds(el);

    // Handle task checkboxes — write back to source. Only GFM task items are
    // bound (they render with `disabled`); raw-HTML checkboxes in the source
    // must not shift the index mapping.
    if (onToggleTask) {
      const cbs = el.querySelectorAll<HTMLInputElement>('.md-viewer input[type="checkbox"][disabled]');
      cbs.forEach((cb, idx) => {
        const newCb = cb.cloneNode(true) as HTMLInputElement;
        cb.replaceWith(newCb);
        newCb.disabled = false;
        newCb.addEventListener("change", () => {
          // Use source line number if available, otherwise fall back to index
          const line = taskLines && taskLines[idx] ? taskLines[idx] : idx + 1;
          onToggleTask(line, newCb.checked);
        });
      });
    }

    // Smooth scroll for anchor links
    el.querySelectorAll('.md-viewer a[href^="#"]').forEach((a) => {
      const clone = a.cloneNode(true);
      a.replaceWith(clone);
      clone.addEventListener("click", (e) => {
        e.preventDefault();
        const id = (clone as HTMLAnchorElement).getAttribute("href")?.slice(1);
        if (id) {
          const target = el.querySelector(`#${CSS.escape(id)}`);
          target?.scrollIntoView({ behavior: "smooth" });
        }
      });
    });

    // Intercept cross-document links (.md / .markdown) when a handler is provided
    if (onOpenDocument) {
      el.querySelectorAll('.md-viewer a[href]').forEach((a) => {
        const href = (a as HTMLAnchorElement).getAttribute("href") || "";
        // Skip pure anchors, web/mailto links
        if (href.startsWith("#") || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
          return;
        }
        // Only intercept .md / .markdown paths
        if (!/\.(md|markdown)$/i.test(href)) {
          return;
        }
        const clone = a.cloneNode(true) as HTMLAnchorElement;
        a.replaceWith(clone);
        clone.addEventListener("click", (e) => {
          e.preventDefault();
          onOpenDocument(href);
        });
      });
    }
  }, [html, onToggleTask, onOpenDocument]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="preview-pane">
      <div className="preview-scroll" ref={ref as React.Ref<HTMLDivElement>} onScroll={onScroll}>
        <div className="md-viewer" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
});
