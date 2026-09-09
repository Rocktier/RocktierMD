import { memo, useCallback, useRef, type RefObject } from "react";

interface Props {
  content: string;
  onChange: (content: string) => void;
  path?: string;
  textareaRef?: RefObject<HTMLTextAreaElement>;
  onScroll?: () => void;
  onImagePaste?: (dataUrl: string) => void;
}

const INDENT = "  ";

export const Editor = memo(function Editor({ content, onChange, textareaRef, onScroll, onImagePaste }: Props) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef || internalRef;

  const onInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
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
        const shifted = value
          .slice(lineStart, end)
          .split("\n")
          .map((line) => {
            if (e.shiftKey) {
              if (line.startsWith(INDENT)) {
                return line.slice(INDENT.length);
              }
              return line;
            }
            return INDENT + line;
          })
          .join("\n");
        el.value = value.slice(0, lineStart) + shifted + value.slice(end);
        el.selectionStart = lineStart;
        el.selectionEnd = lineStart + shifted.length;
        onChange(el.value);
        return;
      }

      if (e.shiftKey) {
        const before = value.substring(0, s);
        const nl = before.lastIndexOf("\n");
        const ls = nl + 1;
        if (value.substring(ls, ls + INDENT.length) === INDENT) {
          el.value = value.substring(0, ls) + value.substring(ls + INDENT.length);
          el.selectionStart = el.selectionEnd = Math.max(ls, s - INDENT.length);
        }
      } else {
        el.value = value.substring(0, s) + INDENT + value.substring(end);
        el.selectionStart = el.selectionEnd = s + INDENT.length;
      }
      onChange(el.value);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      const s = el.selectionStart;
      const before = el.value.substring(0, s);
      const nl = before.lastIndexOf("\n") + 1;
      const line = before.substring(nl);
      if (line.match(/^\s*[-*+]\s+$/)) {
        e.preventDefault();
        el.value = el.value.substring(0, nl) + "\n" + el.value.substring(s);
        el.selectionStart = el.selectionEnd = nl + 1;
        onChange(el.value);
        return;
      }
      const m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
      if (m && m[3].trim() !== "") {
        e.preventDefault();
        const nm = /^\d+/.test(m[2]) ? `${parseInt(m[2]) + 1}. ` : `${m[2]} `;
        const ins = `\n${m[1]}${nm}`;
        el.value = el.value.substring(0, s) + ins + el.value.substring(el.selectionEnd);
        el.selectionStart = el.selectionEnd = s + ins.length;
        onChange(el.value);
      }
      // GFM task list continuation
      const tline = line.match(/^(\s*)([-*+])\s+\[[ xX]\]\s+(.*)$/);
      if (tline && tline[4].trim() !== "") {
        e.preventDefault();
        const ins = `\n${tline[1]}${tline[2]}[ ] `;
        el.value = el.value.substring(0, s) + ins + el.value.substring(el.selectionEnd);
        el.selectionStart = el.selectionEnd = s + ins.length;
        onChange(el.value);
        return;
      }
    }
  }, [onChange]);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const el = ref.current;
          if (!el) return;
          const s = el.selectionStart;
          const end = el.selectionEnd;
          const md = `![image](${dataUrl})`;
          el.value = el.value.substring(0, s) + md + el.value.substring(end);
          el.selectionStart = el.selectionEnd = s + md.length;
          onChange(el.value);
          onImagePaste?.(dataUrl);
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  }, [onChange, onImagePaste]);

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
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder="Start writing Markdown..."
        />
      </div>
    </div>
  );
});
