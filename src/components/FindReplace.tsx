import { memo, useCallback, useEffect, useRef, useState } from "react";

interface FindReplaceButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  bordered?: boolean;
}

const FindReplaceButton = memo(function FindReplaceButton({
  onClick,
  disabled,
  title,
  children,
  bordered,
}: FindReplaceButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: bordered
          ? "1px solid var(--border, rgba(255,255,255,0.06))"
          : "none",
        background: hovered && !disabled
          ? "var(--accent-muted, rgba(255,255,255,0.08))"
          : "transparent",
        cursor: !disabled ? "pointer" : "default",
        padding: bordered ? "4px 8px" : "4px 6px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "4px",
        color: hovered && !disabled
          ? "var(--text-primary, #fff)"
          : "var(--text-secondary, rgba(255,255,255,0.7))",
        fontSize: bordered ? "12px" : "14px",
        opacity: disabled ? 0.35 : 1,
        whiteSpace: bordered ? "nowrap" : "normal",
        lineHeight: 1,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
});

interface Props {
  content: string;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onChange: (newContent: string) => void;
  onClose: () => void;
}

export const FindReplace = memo(function FindReplace({
  content,
  textareaRef,
  onChange,
  onClose,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    const t = setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  // Compute all match start indices for the current search term in content
  const computeMatches = useCallback(
    (term: string): number[] => {
      if (!term) return [];
      const indices: number[] = [];
      let i = 0;
      while (i <= content.length - term.length) {
        const found = content.indexOf(term, i);
        if (found === -1) break;
        indices.push(found);
        i = found + term.length;
      }
      return indices;
    },
    [content]
  );

  // Select a match in the textarea and scroll into view
  const selectMatch = useCallback(
    (indices: number[], idx: number) => {
      const el = textareaRef.current;
      if (!el || indices.length === 0) return;
      const clamped = ((idx % indices.length) + indices.length) % indices.length;
      const start = indices[clamped];
      const end = start + searchTerm.length;

      el.focus();
      el.setSelectionRange(start, end);

      // Scroll into view: compute line number by counting \n before match
      const line = content.substring(0, start).split("\n").length - 1;
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
      const targetScroll = line * lineHeight - el.clientHeight / 3;
      el.scrollTop = Math.max(0, targetScroll);
    },
    [textareaRef, searchTerm.length, content]
  );

  // Handle search input change
  const onSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const term = e.target.value;
      setSearchTerm(term);
      const indices = computeMatches(term);
      setMatchCount(indices.length);
      setMatchIndex(indices.length > 0 ? 1 : 0); // show "1/N" style; we displaying as idx/total but 1-based for label
      if (indices.length > 0) {
        selectMatch(indices, 0);
      }
    },
    [computeMatches, selectMatch]
  );

  // Go to next match
  const goNext = useCallback(() => {
    const indices = computeMatches(searchTerm);
    if (indices.length === 0) return;
    // If current selection already matches a specific index, go from there
    const el = textareaRef.current;
    let nextIndex = matchIndex % indices.length; // wrap
    if (el) {
      const selStart = el.selectionStart;
      // Try to find the current match index from selection
      const foundAt = indices.indexOf(selStart);
      if (foundAt !== -1) {
        nextIndex = (foundAt + 1) % indices.length;
      }
    }
    setMatchIndex(nextIndex + 1);
    selectMatch(indices, nextIndex);
  }, [computeMatches, matchIndex, searchTerm, selectMatch, textareaRef]);

  // Go to previous match
  const goPrev = useCallback(() => {
    const indices = computeMatches(searchTerm);
    if (indices.length === 0) return;
    const el = textareaRef.current;
    let prevIndex = (matchIndex - 2 + indices.length) % indices.length;
    if (el) {
      const selStart = el.selectionStart;
      const foundAt = indices.indexOf(selStart);
      if (foundAt !== -1) {
        prevIndex = (foundAt - 1 + indices.length) % indices.length;
      }
    }
    setMatchIndex(prevIndex + 1);
    selectMatch(indices, prevIndex);
  }, [computeMatches, matchIndex, searchTerm, selectMatch, textareaRef]);

  // Replace current selection and advance
  const doReplace = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !searchTerm) return;
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;
    const selectedText = content.substring(selStart, selEnd);

    if (selectedText === searchTerm) {
      const newContent =
        content.substring(0, selStart) + replaceText + content.substring(selEnd);
      onChange(newContent);

      // The textarea value hasn't updated yet from the prop change, so use
      // requestAnimationFrame to run after React has flushed
      requestAnimationFrame(() => {
        const newIndices: number[] = [];
        let i = 0;
        while (i <= newContent.length - searchTerm.length) {
          const f = newContent.indexOf(searchTerm, i);
          if (f === -1) break;
          newIndices.push(f);
          i = f + searchTerm.length;
        }
        const count = newIndices.length;
        setMatchCount(count);

        if (count > 0) {
          // Select the next available match after the replaced position
          const nextPos = selStart + replaceText.length;
          let nextMatchIdx = newIndices.findIndex((pos) => pos >= nextPos);
          if (nextMatchIdx === -1) nextMatchIdx = 0;
          setMatchIndex(nextMatchIdx + 1);
          const s = newIndices[nextMatchIdx];
          const end = s + searchTerm.length;
          el.focus();
          el.setSelectionRange(s, end);
          // Scroll into view
          const line = newContent.substring(0, s).split("\n").length - 1;
          const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
          el.scrollTop = Math.max(0, line * lh - el.clientHeight / 3);
        } else {
          setMatchIndex(0);
        }
      });
    } else {
      // Selection doesn't match; go to next instead
      goNext();
    }
  }, [textareaRef, searchTerm, replaceText, content, onChange, computeMatches, goNext]);

  // Replace all occurrences
  const doReplaceAll = useCallback(() => {
    if (!searchTerm) return;
    const newContent = content.replaceAll(searchTerm, replaceText);
    onChange(newContent);
    setMatchCount(0);
    setMatchIndex(0);
  }, [searchTerm, replaceText, content, onChange]);

  // Global Escape handler + Enter/Shift+Enter on search input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        goPrev();
      } else {
        goNext();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const hasTerm = searchTerm.length > 0;
  const counterLabel = matchCount > 0 ? `${matchIndex}/${matchCount}` : "0/0";

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        background: "var(--bg-floating, #141414)",
        borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))",
        padding: "6px 10px",
        display: "flex",
        gap: "6px",
        alignItems: "center",
        font: "inherit",
      }}
      className="find-replace-bar"
    >
      {/* Search input */}
      <input
        ref={searchInputRef}
        type="text"
        value={searchTerm}
        onChange={onSearchChange}
        onKeyDown={onSearchKeyDown}
        placeholder="Find"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          border: "1px solid var(--border, rgba(255,255,255,0.06))",
          background: "var(--bg-primary, #000)",
          color: "var(--text-primary, #fff)",
          padding: "4px 8px",
          fontSize: "13px",
          borderRadius: "4px",
          outline: "none",
          fontFamily: "inherit",
        }}
      />

      {/* Match counter */}
      <span
        style={{
          fontSize: "12px",
          color: "var(--text-muted, rgba(255,255,255,0.3))",
          minWidth: "40px",
          textAlign: "center",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {counterLabel}
      </span>

      {/* Replace input */}
      <input
        type="text"
        value={replaceText}
        onChange={(e) => setReplaceText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="Replace"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        style={{
          flex: "1 1 auto",
          minWidth: 0,
          border: "1px solid var(--border, rgba(255,255,255,0.06))",
          background: "var(--bg-primary, #000)",
          color: "var(--text-primary, #fff)",
          padding: "4px 8px",
          fontSize: "13px",
          borderRadius: "4px",
          outline: "none",
          fontFamily: "inherit",
        }}
      />

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {/* Previous */}
        <FindReplaceButton onClick={goPrev} disabled={!hasTerm} title="Previous match (Shift+Enter)">
          &#9664;
        </FindReplaceButton>

        {/* Next */}
        <FindReplaceButton onClick={goNext} disabled={!hasTerm} title="Next match (Enter)">
          &#9654;
        </FindReplaceButton>

        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: "18px",
            background: "var(--border, rgba(255,255,255,0.06))",
            flexShrink: 0,
          }}
        />

        {/* Replace */}
        <FindReplaceButton
          onClick={doReplace}
          disabled={!hasTerm || matchCount === 0}
          title="Replace"
          bordered
        >
          Replace
        </FindReplaceButton>

        {/* Replace All */}
        <FindReplaceButton
          onClick={doReplaceAll}
          disabled={!hasTerm}
          title="Replace All"
          bordered
        >
          All
        </FindReplaceButton>

        {/* Close */}
        <FindReplaceButton onClick={onClose} title="Close (Escape)">
          &times;
        </FindReplaceButton>
      </div>

      {/* Focus ring for inputs */}
      <style>{`
        .find-replace-bar input:focus {
          border-color: var(--border-mid, rgba(255,255,255,0.1)) !important;
        }
      `}</style>
    </div>
  );
});
