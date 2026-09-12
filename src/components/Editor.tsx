import { memo, useCallback, useRef, type RefObject } from "react";
import { t, useUiLang } from "../i18n";
import { htmlToMarkdown } from "../services/htmlToMarkdown";

interface Props {
  content: string;
  onChange: (content: string) => void;
  textareaRef?: RefObject<HTMLTextAreaElement>;
  onScroll?: () => void;
  onImagePaste?: () => void;
  saveImagePaste?: (dataUrl: string) => Promise<string | null>;
  onCursorMove?: () => void;
}

const INDENT = "  ";

export const Editor = memo(function Editor({ content, onChange, textareaRef, onScroll, onImagePaste, saveImagePaste, onCursorMove }: Props) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef || internalRef;
  useUiLang(); // 语言切换时重渲染

  const onInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  // Splice text into the textarea. execCommand("insertText") keeps the native
  // undo stack intact — assigning el.value directly would wipe it.
  const splice = useCallback((el: HTMLTextAreaElement, from: number, to: number, text: string) => {
    el.focus();
    el.setSelectionRange(from, to);
    if (!document.execCommand("insertText", false, text)) {
      el.value = el.value.slice(0, from) + text + el.value.slice(to);
      el.setSelectionRange(from + text.length, from + text.length);
    }
    onChange(el.value);
  }, [onChange]);

  const onKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === "Tab") {
      e.preventDefault();
      const s = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;

      // Multi-line selection: indent / outdent every line in the block
      if (s !== end && value.slice(s, end).includes("\n")) {
        const lineStart = value.lastIndexOf("\n", s - 1) + 1;
        const block = value
          .slice(lineStart, end)
          .split("\n")
          .map((line) => {
            if (e.shiftKey) {
              return line.startsWith(INDENT) ? line.slice(INDENT.length) : line;
            }
            return INDENT + line;
          })
          .join("\n");
        splice(el, lineStart, end, block);
        el.setSelectionRange(lineStart, lineStart + block.length);
        return;
      }

      if (e.shiftKey) {
        const nl = value.lastIndexOf("\n", s - 1) + 1;
        if (value.slice(nl, nl + INDENT.length) === INDENT) {
          splice(el, nl, nl + INDENT.length, "");
          const caret = Math.max(nl, s - INDENT.length);
          el.setSelectionRange(caret, caret);
        }
      } else {
        splice(el, s, end, INDENT);
      }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && el.selectionStart === el.selectionEnd) {
      const s = el.selectionStart;
      const before = el.value.slice(0, s);
      const nl = before.lastIndexOf("\n") + 1;
      const line = before.slice(nl);

      // Empty list marker alone on the line: exit the list
      if (/^\s*[-*+]\s+$/.test(line) || /^\s*[-*+]\s+\[[ xX]\]\s*$/.test(line)) {
        e.preventDefault();
        splice(el, nl, s, "");
        return;
      }
      // GFM task item first — the generic list regex would also match it
      const task = line.match(/^(\s*)([-*+])\s+\[[ xX]\]\s+(.+)$/);
      if (task) {
        e.preventDefault();
        splice(el, s, s, `\n${task[1]}${task[2]} [ ] `);
        return;
      }
      // Plain / ordered list continuation
      const list = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
      if (list) {
        e.preventDefault();
        const marker = /^\d+/.test(list[2]) ? `${parseInt(list[2], 10) + 1}. ` : `${list[2]} `;
        splice(el, s, s, `\n${list[1]}${marker}`);
        return;
      }
    }
  }, [onChange, splice]);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          const el = ref.current;
          if (!el) return;
          // 优先落盘到文档同目录 assets/ 并插入相对路径（本轮 U2）——
          // 几 MB 的 base64 进文档后每次按键都要被完整解析；落盘失败或
          // 文档未保存时退回 base64 内联。
          let markdown = `![image](${dataUrl})`;
          if (saveImagePaste) {
            const saved = await saveImagePaste(dataUrl);
            if (saved) markdown = `![image](${saved})`;
          }
          // 走 splice（execCommand insertText）而非直接赋值 value，
          // 保住原生 undo 栈——⌘Z 可撤销粘贴（复审 F6）。
          splice(el, el.selectionStart, el.selectionEnd, markdown);
          onImagePaste?.();
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
    // Rich text (HTML) → Markdown
    const html = e.clipboardData?.getData("text/html");
    if (html) {
      e.preventDefault();
      const el = ref.current;
      if (!el) return;
      splice(el, el.selectionStart, el.selectionEnd, htmlToMarkdown(html));
    }
  }, [splice, onImagePaste, saveImagePaste]);

  return (
    <div className="editor-pane">
      <div className="editor-scroll">
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          className="editor-area"
          value={content}
          onChange={onInput}
          onKeyDown={onKey}
          onPaste={onPaste}
          onScroll={onScroll}
          onKeyUp={onCursorMove}
          onClick={onCursorMove}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder={t("editor.placeholder")}
        />
      </div>
    </div>
  );
});
