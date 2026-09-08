import { useCallback, useRef, type RefObject } from "react";

type ScrollSource = "editor" | "preview";

interface ScrollLock {
  source: ScrollSource;
  until: number; // timestamp (ms)
}

/**
 * Bidirectional scroll sync between editor and preview panes.
 * Returns two handlers to attach to each pane's onScroll.
 * A ref-based time window prevents feedback loops from programmatic
 * scroll events without leaking timers.
 */
export function useScrollSync(
  editorRef: RefObject<HTMLTextAreaElement>,
  previewRef: RefObject<HTMLDivElement>
) {
  const lockRef = useRef<ScrollLock | null>(null);

  const sync = useCallback((source: ScrollSource) => {
    const lock = lockRef.current;
    // Ignore the echo of a programmatic scroll on the other pane
    if (lock && lock.source !== source && Date.now() < lock.until) return;
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    lockRef.current = { source, until: Date.now() + 60 };

    const editorScrollable = editor.scrollHeight - editor.clientHeight;
    const previewScrollable = preview.scrollHeight - preview.clientHeight;

    if (editorScrollable > 0 && previewScrollable > 0) {
      if (source === "editor") {
        const ratio = editor.scrollTop / editorScrollable;
        preview.scrollTop = ratio * previewScrollable;
      } else {
        const ratio = preview.scrollTop / previewScrollable;
        editor.scrollTop = ratio * editorScrollable;
      }
    }
  }, [editorRef, previewRef]);

  const onEditorScroll = useCallback(() => sync("editor"), [sync]);
  const onPreviewScroll = useCallback(() => sync("preview"), [sync]);

  return { onEditorScroll, onPreviewScroll };
}
