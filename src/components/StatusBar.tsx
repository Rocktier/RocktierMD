import { memo } from "react";
import { t, useUiLang } from "../i18n";

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
    </footer>
  );
});
