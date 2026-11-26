import Link from "next/link";
import { getDictionary, getPetCopy, type Locale } from "../lib/i18n";
import { PET_KINDS } from "../lib/pets";
import { Logo } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { MOOD_TO_SPRITE_MOOD } from "./pet";
import { PetSprite } from "./pet-sprites";
import { WelcomeDemo } from "./welcome-demo";

export function WelcomePage({ locale = "pt" }: { locale?: Locale }) {
  const t = getDictionary(locale);

  return (
    <>
      <a className="skip" href="#boas-vindas">
        {t.welcome.skipLink}
      </a>

      <header className="topbar welcome-topbar">
        <Link href="/" className="brand" aria-label={t.common.brandName}>
          <Logo size={32} mood="happy" title={t.common.brandName} />
        </Link>
        <div className="welcome-topbar-actions">
          <LanguageSwitcher locale={locale} />
          <nav className="welcome-auth-nav" aria-label={t.nav.primaryAria}>
            <Link href="/entrar" className="welcome-nav-signin">
              {t.welcome.signIn}
            </Link>
            <Link href="/criar-conta" className="welcome-nav-signup">
              {t.welcome.createAccount}
            </Link>
          </nav>
        </div>
      </header>

      <main className="welcome-main" id="boas-vindas" tabIndex={-1}>
        <section className="welcome-hero" aria-labelledby="welcome-hero-title">
          <div className="welcome-hero-copy">
            <h1 id="welcome-hero-title">{t.welcome.heroTitle}</h1>
            <p className="welcome-hero-subtitle">{t.welcome.heroSubtitle}</p>
            <div className="welcome-cta-group">
              <Link href="/criar-conta" className="welcome-cta-primary">
                {t.welcome.heroCtaPrimary}
              </Link>
              <Link href="/entrar" className="welcome-cta-secondary">
                {t.welcome.heroCtaSecondary}
              </Link>
            </div>
            <p className="welcome-hero-note">{t.welcome.heroNote}</p>
          </div>
          <div className="welcome-hero-stage">
            <WelcomeDemo locale={locale} />
          </div>
        </section>

        <section
          className="welcome-companions"
          aria-labelledby="welcome-companions-title"
        >
          <div className="welcome-section-header">
            <h2 id="welcome-companions-title">{t.welcome.companions.title}</h2>
            <p>{t.welcome.companions.subtitle}</p>
          </div>

          <ul className="welcome-mood-rules">
            {t.welcome.companions.rules.map((rule) => (
              <li key={rule.mood} className="welcome-mood-rule">
                <PetSprite
                  kind="original"
                  mood={MOOD_TO_SPRITE_MOOD[rule.mood]}
                  size={56}
                  decorative
                />
                <div>
                  <div className="welcome-mood-rule-top">
                    <span className={`mood mood-${rule.mood}`}>
                      {rule.badge}
                    </span>
                    <strong>{rule.threshold}</strong>
                  </div>
                  <p>{rule.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <ul className="welcome-pets-strip">
            {PET_KINDS.map((kind) => {
              const pet = getPetCopy(kind, locale);
              return (
                <li key={kind} className="welcome-pet-item">
                  <PetSprite kind={kind} mood="happy" size={72} decorative />
                  <div>
                    <h3>{pet.name}</h3>
                    <p>{pet.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          className="welcome-features"
          aria-labelledby="welcome-features-title"
        >
          <div className="welcome-section-header">
            <h2 id="welcome-features-title">{t.welcome.features.title}</h2>
            <p>{t.welcome.features.subtitle}</p>
          </div>

          <div className="welcome-chapters">
            {t.welcome.features.items.map((item) => (
              <article key={item.heading} className="welcome-chapter">
                <div className="welcome-chapter-intro">
                  <span className="welcome-chapter-tag">{item.tag}</span>
                  <h3>{item.heading}</h3>
                </div>
                <div className="welcome-chapter-body">
                  <p>{item.body}</p>
                  <ul>
                    {item.highlights.map((highlight) => (
                      <li key={highlight}>
                        <span className="welcome-chapter-check" aria-hidden="true">
                          ✓
                        </span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="welcome-closing"
          aria-labelledby="welcome-closing-title"
        >
          <div className="welcome-closing-copy">
            <h2 id="welcome-closing-title">{t.welcome.cta.title}</h2>
            <p>{t.welcome.cta.subtitle}</p>
          </div>
          <div className="welcome-cta-group">
            <Link href="/criar-conta" className="welcome-cta-primary">
              {t.welcome.cta.primary}
            </Link>
            <Link href="/entrar" className="welcome-cta-secondary">
              {t.welcome.cta.secondary}
            </Link>
          </div>
        </section>
      </main>

      <footer>
        {t.common.brandName} <span>{t.common.tagline}</span>
      </footer>
    </>
  );
}
