import { useEffect } from "react";

interface ShortcutActions {
  onSave: () => void;
  onSaveAs: () => void;
  onNew: () => void;
  onOpen: () => void;
  onToggleSidebar: () => void;
  onFindReplace: () => void;
  onExportPdf: () => void;
}

/**
 * Global keyboard shortcuts for the editor.
 * ⌘S = Save · ⌘⇧S = Save As · ⌘N = New · ⌘O = Open · ⌘\ = Toggle sidebar
 * ⌘F = Find · ⌘⇧P = Export PDF
 */
export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;

      // Shift produces uppercase e.key ("S" for ⌘⇧S) — normalize so the
      // shift-combo shortcuts actually match.
      switch (e.key.toLowerCase()) {
        case "s":
          e.preventDefault();
          e.shiftKey ? actions.onSaveAs() : actions.onSave();
          break;
        case "n":
          e.preventDefault();
          actions.onNew();
          break;
        case "o":
          e.preventDefault();
          actions.onOpen();
          break;
        case "\\":
          e.preventDefault();
          actions.onToggleSidebar();
          break;
        case "f":
          e.preventDefault();
          actions.onFindReplace();
          break;
        case "p":
          // 复审 F12：无 shift 的 ⌘P 一并拦截，防止浏览器 dev 模式弹系统
          // 打印、与 ⌘⇧P 导出语义混淆。
          e.preventDefault();
          if (e.shiftKey) actions.onExportPdf();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
