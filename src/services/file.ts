// File I/O service — Tauri-backed

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
  await writeTextFile(path, content);
}

export async function saveFileAs(content: string, defaultName?: string): Promise<string | null> {
  const path = await dialogSave({
    filters: MD_EXTENSIONS,
    defaultPath: defaultName || "Untitled.md",
  });

  if (!path) return null;

  await writeTextFile(path, content);
  return path;
}
