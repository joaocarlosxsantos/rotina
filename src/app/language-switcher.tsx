import { setLocaleAction } from "./locale-action";
import { getDictionary, type Locale } from "../lib/i18n";

export function LanguageSwitcher({ locale = "pt" }: { locale?: Locale }) {
  const t = getDictionary(locale);
  return (
    <form
      action={setLocaleAction}
      className="language-switcher"
      role="group"
      aria-label={t.common.languageLabel}
    >
      <button
        type="submit"
        name="locale"
        value="pt"
        className="lang-btn"
        aria-pressed={locale === "pt"}
      >
        PT<span className="visually-hidden"> ({t.common.ptName})</span>
      </button>
      <button
        type="submit"
        name="locale"
        value="en"
        className="lang-btn"
        aria-pressed={locale === "en"}
      >
        EN<span className="visually-hidden"> ({t.common.enName})</span>
      </button>
    </form>
  );
}
