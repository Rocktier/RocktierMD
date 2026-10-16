import { memo } from "react";
import { LOCALES, t, useUiLang, getUiLang, setUiLang, type UiLang } from "../i18n";
import type { LicenseInfo } from "../services/license";

interface Props {
  words: number;
  line: number;
  column: number;
  gitBranch?: string;
  /** 许可状态：显示试用剩余天数，并作为进入"许可与激活"的入口。 */
  license?: LicenseInfo | null;
  onLicenseClick?: () => void;
}

export const StatusBar = memo(function StatusBar({ words, line, column, gitBranch, license, onLicenseClick }: Props) {
  useUiLang(); // 语言切换时重渲染（复审 F9）

  /* 只在直链版且尚未买断时提示 —— 商店版由商店收款，这里再提一句"试用/购买"既多余，
     又容易在审核眼里变成"引导外部购买"。已激活时同样不占状态栏（入口在帮助菜单）。 */
  const showLicenseChip =
    !!license && license.channel === "direct" && license.status !== "licensed";

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
      <span className="spacer" />
      {showLicenseChip && (
        <button
          type="button"
          className={`status-license${license.status === "expired" ? " expired" : ""}`}
          onClick={onLicenseClick}
          title={license.status === "expired" ? t("license.expired") : t("license.trialLeft", { days: license.daysLeft })}
        >
          {license.status === "expired"
            ? t("license.expiredChip")
            : t("license.trialChip", { days: license.daysLeft })}
        </button>
      )}
      <span className="sep" />
      {/* 家族语言 2026-10-13 收敛为 en/zh 两门（旧注释「标准 8 门」作废）。
          保留原生 select：选项少也维持跨平台一致行为，键盘与读屏器支持
          免费获得；未来加回多语言时不用改控件。选项显示 endonym（语言自称）。 */}
      <select
        className="status-lang"
        value={getUiLang()}
        onChange={(e) => setUiLang(e.target.value as UiLang)}
        aria-label="Language"
        title="Language"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>{l.endonym}</option>
        ))}
      </select>
    </footer>
  );
});
