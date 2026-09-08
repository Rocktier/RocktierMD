import { useEffect } from "react";

interface ShortcutActions {
  onSave: () => void;
  onSaveAs: () => void;
  onNew: () => void;
  onOpen: () => void;
  onToggleSidebar: () => void;
}

/**
 * Global keyboard shortcuts for the editor.
 * ⌘S = Save · ⌘⇧S = Save As · ⌘N = New · ⌘O = Open · ⌘\ = Toggle sidebar
 */
export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;

      switch (e.key) {
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
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
