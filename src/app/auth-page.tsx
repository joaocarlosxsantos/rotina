import Link from "next/link";
import { getDictionary, type Locale } from "../lib/i18n";
import { AuthForm } from "./auth-form";
import { Logo } from "./brand";
import { LanguageSwitcher } from "./language-switcher";

export function AuthPage({
  signup = false,
  notice = false,
  locale = "pt",
}: {
  signup?: boolean;
  notice?: boolean;
  locale?: Locale;
}) {
  const t = getDictionary(locale);

  return (
    <>
      <a className="skip" href="#acesso">
        {t.auth.skipLink}
      </a>
      <header className="topbar auth-topbar">
        <Link href="/" className="brand" aria-label={t.common.brandName}>
          <Logo size={32} title={t.common.brandName} />
        </Link>
        <LanguageSwitcher locale={locale} />
      </header>
      <main className="auth-page" id="acesso" tabIndex={-1}>
        <p className="auth-back">
          <Link href="/" className="auth-back-link">
            {t.auth.backToWelcome}
          </Link>
        </p>
        <h1>{signup ? t.auth.signUpTitle : t.auth.signInTitle}</h1>
        <p>{signup ? t.auth.signUpSubtitle : t.auth.signInSubtitle}</p>
        {notice && (
          <p className="notice" role="status">
            {t.auth.checkEmailNotice}
          </p>
        )}
        <AuthForm signup={signup} locale={locale} />
      </main>
    </>
  );
}
