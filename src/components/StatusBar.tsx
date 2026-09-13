import { memo } from "react";
import { t, useUiLang, getUiLang, setUiLang } from "../i18n";

interface Props {
  words: number;
  line: number;
  column: number;
  gitBranch?: string;
}

export const StatusBar = memo(function StatusBar({ words, line, column, gitBranch }: Props) {
  useUiLang(); // 语言切换时重渲染（复审 F9）

  return (
    <footer className="status-bar">
      <span>{t("status.words", { n: words })}</span>
      <span className="sep" />
      <span>{t("status.lineCol", { line, col: column })}</span>
      {gitBranch && (
        <>
          <span className="sep" />
          <span>{gitBranch}</span>
        </>
      )}
      <span className="sep" />
      <button
        type="button"
        className="status-lang"
        onClick={() => setUiLang(getUiLang() === "zh" ? "en" : "zh")}
        title={getUiLang() === "zh" ? "Switch to English" : "切换为中文"}
      >
        {getUiLang() === "zh" ? "EN" : "中文"}
      </button>
    </footer>
  );
});
