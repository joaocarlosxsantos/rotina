import type { Metadata } from "next";
import { requireCurrentUser } from "../../auth/server";
import { getDatabase } from "../../db/client";
import { getDictionary, getPetCopy } from "../../lib/i18n";
import { getLocale } from "../../lib/i18n-server";
import { PET_KINDS, type PetKind } from "../../lib/pets";
import { getUserPet } from "../../lib/store";
import { selectPet } from "../actions";
import { Header } from "../header";
import { PetSprite } from "../pet-sprites";
import { Submit } from "../submit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDictionary(locale).meta.petsTitle };
}

export default async function PetsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.pets;
  const currentPet = await getUserPet(await getDatabase(), user);
  const query = await searchParams;

  return (
    <>
      <a className="skip" href="#pets-grid">
        {t.skipLink}
      </a>

      <Header active="pets" user={user} locale={locale} />

      <main className="pets-page" id="pets-grid">
        <div className="pets-hero">
          <div className="hero-content">
            <span className="hero-eyebrow">{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
        </div>

        {typeof query.error === "string" && query.error && (
          <p className="notice error" role="alert">
            {query.error.slice(0, 200)}
          </p>
        )}
        {typeof query.success === "string" && query.success && (
          <p className="notice" role="status">
            {query.success.slice(0, 200)}
          </p>
        )}

        <section aria-labelledby="catalog-title" className="pets-catalog">
          <div className="section-title">
            <h2 id="catalog-title">{t.catalogTitle}</h2>
            <span>{t.petsCount(PET_KINDS.length)}</span>
          </div>

          <div className="pets-grid">
            {PET_KINDS.map((kind: PetKind) => {
              const def = getPetCopy(kind, locale);
              const isCurrent = kind === currentPet;

              return (
                <article
                  key={kind}
                  className={`pet-card ${isCurrent ? "current" : ""}`}
                  aria-labelledby={`pet-name-${kind}`}
                >
                  <div className="pet-card-header">
                    <div>
                      <h3 id={`pet-name-${kind}`}>{def.name}</h3>
                      <p className="pet-desc">{def.description}</p>
                    </div>
                    {isCurrent &&
                      (locale === "en" ? (
                        <span
                          className="badge-current"
                          aria-label={t.currentBadgeAria}
                        >
                          {t.currentBadge}
                        </span>
                      ) : (
                        <span
                          className="badge-current"
                          aria-label="Pet atualmente selecionado"
                        >
                          {t.currentBadge}
                        </span>
                      ))}
                  </div>

                  <div className="pet-preview-stage">
                    <div className="preview-mood-item preview-triste">
                      <div className="preview-sprite-wrapper mood-triste-anim">
                        <PetSprite
                          kind={kind}
                          mood="sad"
                          size={64}
                          decorative
                        />
                      </div>
                      <span className="preview-mood-label">{t.moods.sad}</span>
                    </div>

                    <div className="preview-mood-item preview-ok">
                      <div className="preview-sprite-wrapper mood-ok-anim">
                        <PetSprite
                          kind={kind}
                          mood="ok"
                          size={64}
                          decorative
                        />
                      </div>
                      <span className="preview-mood-label">{t.moods.ok}</span>
                    </div>

                    <div className="preview-mood-item preview-feliz">
                      <div className="preview-sprite-wrapper mood-feliz-anim">
                        <PetSprite
                          kind={kind}
                          mood="happy"
                          size={64}
                          decorative
                        />
                      </div>
                      <span className="preview-mood-label">{t.moods.happy}</span>
                    </div>
                  </div>

                  <div className="pet-card-actions">
                    {isCurrent ? (
                      <div className="pet-status-active" aria-current="true">
                        {locale === "en"
                          ? t.activeCompanion
                          : "✓ Companheiro ativo"}
                      </div>
                    ) : (
                      <form action={selectPet}>
                        <input type="hidden" name="petKind" value={kind} />
                        <Submit className="choose-btn" locale={locale}>
                          {t.chooseBtn(def.name)}
                        </Submit>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <footer>
        {dict.common.brandName} <span>{dict.common.tagline}</span>
      </footer>
    </>
  );
}
