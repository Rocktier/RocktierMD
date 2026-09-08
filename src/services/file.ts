// File I/O service — Tauri-backed for desktop, with web fallback

import { open as dialogOpen, save as dialogSave, ask } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, exists } from "@tauri-apps/plugin-fs";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MD_EXTENSIONS = [
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd", "mkdn", "mdwn", "mdtxt", "mdtext", "text", "txt"] },
  { name: "All Files", extensions: ["*"] },
];

/** Native warning dialog in Tauri, window.confirm in browser-only dev mode. */
export async function confirmDialog(message: string): Promise<boolean> {
  if (isTauri) {
    try {
      return await ask(message, { title: "Rocktier Markdown", kind: "warning" });
    } catch {
      return window.confirm(message);
    }
  }
  return window.confirm(message);
}

export async function openFile(): Promise<{ path: string; content: string } | null> {
  if (!isTauri) {
    return openFileWeb();
  }

  try {
    const path = await dialogOpen({
      multiple: false,
      filters: MD_EXTENSIONS,
    });

    if (!path || Array.isArray(path)) return null;

    const fileExists = await exists(path);
    if (!fileExists) return null;

    const content = await readTextFile(path);
    return { path, content };
  } catch (err) {
    console.error("Failed to open file:", err);
    return null;
  }
}

export async function saveFile(path: string, content: string): Promise<void> {
  if (!isTauri) {
    return saveFileWeb(path, content);
  }

  try {
    await writeTextFile(path, content);
  } catch (err) {
    console.error("Failed to save file:", err);
    throw err;
  }
}

export async function saveFileAs(content: string, defaultName?: string): Promise<string | null> {
  if (!isTauri) {
    return saveFileAsWeb(content, defaultName);
  }

  try {
    const path = await dialogSave({
      filters: MD_EXTENSIONS,
      defaultPath: defaultName || "Untitled.md",
    });

    if (!path) return null;

    await writeTextFile(path, content);
    return path;
  } catch (err) {
    console.error("Failed to save file:", err);
    throw err;
  }
}

// ── Web fallback (browser-only dev mode) ─────────────────────────
// These functions are dead code in the production Tauri .app build.
// Kept because `npm run dev` without Tauri shell can still benefit
// from a browser-only file open/save experience.

/** @fallback Browser-only: open file via <input type=file> */
function openFileWeb(): Promise<{ path: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt,.text";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const content = await file.text();
        resolve({ path: file.name, content });
      } catch (err) {
        console.error("Failed to read file:", err);
        resolve(null);
      }
    };

    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** @fallback Browser-only: download file via Blob URL */
function saveFileWeb(path: string, content: string): void {
  triggerDownload(path, content);
}

/** @fallback Browser-only: prompt-less download */
function saveFileAsWeb(content: string, defaultName?: string): Promise<string | null> {
  triggerDownload(defaultName || "Untitled.md", content);
  return Promise.resolve(defaultName || "Untitled.md");
}

function triggerDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
