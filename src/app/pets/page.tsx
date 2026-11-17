import { requireCurrentUser } from "../../auth/server";
import { getDatabase } from "../../db/client";
import { getUserPet } from "../../lib/store";
import { PET_CATALOG, PET_KINDS, type PetKind } from "../../lib/pets";
import { PetSprite } from "../pet-sprites";
import { Header } from "../header";
import { selectPet } from "../actions";
import { Submit } from "../submit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PetsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireCurrentUser();
  const currentPet = await getUserPet(await getDatabase(), user);
  const query = await searchParams;

  return (
    <>
      <a className="skip" href="#pets-grid">
        Pular para lista de companheiros
      </a>

      <Header active="pets" user={user} />

      <main className="pets-page" id="pets-grid">
        <div className="pets-hero">
          <div className="hero-content">
            <span className="hero-eyebrow">Seu Companheiro</span>
            <h1>Escolha quem caminha com você.</h1>
            <p>
              Cada pet traz uma energia única para a sua jornada. Seu progresso
              diário reflete no humor do seu parceiro em cada pequena vitória.
            </p>
          </div>
        </div>

        {query.error && (
          <p className="notice error" role="alert">
            {query.error.slice(0, 200)}
          </p>
        )}
        {query.success && (
          <p className="notice" role="status">
            {query.success.slice(0, 200)}
          </p>
        )}

        <section aria-labelledby="catalog-title" className="pets-catalog">
          <div className="section-title">
            <h2 id="catalog-title">Companheiros disponíveis</h2>
            <span>{PET_KINDS.length} pets</span>
          </div>

          <div className="pets-grid">
            {PET_KINDS.map((kind: PetKind) => {
              const def = PET_CATALOG[kind];
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
                    {isCurrent && (
                      <span className="badge-current" aria-label="Pet atualmente selecionado">
                        Pet atual
                      </span>
                    )}
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
                      <span className="preview-mood-label">Triste</span>
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
                      <span className="preview-mood-label">De boa</span>
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
                      <span className="preview-mood-label">Feliz</span>
                    </div>
                  </div>

                  <div className="pet-card-actions">
                    {isCurrent ? (
                      <div
                        className="pet-status-active"
                        aria-current="true"
                      >
                        ✓ Companheiro ativo
                      </div>
                    ) : (
                      <form action={selectPet}>
                        <input type="hidden" name="petKind" value={kind} />
                        <Submit className="choose-btn">
                          Escolher {def.name}
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
        Rotina Pet <span>Um passo de cada vez.</span>
      </footer>
    </>
  );
}
