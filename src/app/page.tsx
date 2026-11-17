import { getDatabase } from "../db/client";
import { dashboard } from "../lib/store";
import { TIME_ZONE } from "../lib/rules";
import { createActivity, createRoutine, finishActivity } from "./actions";
import { Submit } from "./submit";
import { Pet } from "./pet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const data = await dashboard(getDatabase());
  const query = await searchParams;
  const progress = data.total ? Math.round((data.done / data.total) * 100) : 0;
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const moodCopy = {
    feliz: "Você fez meu dia!",
    ok: "Vamos no seu ritmo.",
    triste: "Um pequeno passo já ajuda.",
  };
  return (
    <>
      <a className="skip" href="#rotinas">
        Pular para minhas rotinas
      </a>
      <header className="topbar">
        <a href="/" className="brand">
          rotina<span>pet</span>
          <span className="brand-dot" aria-hidden="true" />
        </a>
        <span className="local">Seu espaço de cada dia</span>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="date">{date}</p>
            <h1>
              Pequenos passos.
              <br />
              Dias melhores.
            </h1>
            <p>Faça algo por você. Seu companheiro cresce junto.</p>
          </div>
          <div className="score">
            <strong>{data.points.toLocaleString("pt-BR")}</strong>
            <span>pontos conquistados</span>
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
        <div className="workspace">
          <section
            className="routines"
            id="rotinas"
            aria-labelledby="routines-title"
          >
            <div className="section-title">
              <h2 id="routines-title">Minhas rotinas</h2>
              <span>
                {data.routines.length}{" "}
                {data.routines.length === 1 ? "rotina" : "rotinas"}
              </span>
            </div>
            {data.routines.length === 0 && (
              <div className="empty">
                <h3>Toda jornada começa pequena.</h3>
                <p>
                  Crie uma rotina, como “Minha manhã”, e adicione uma atividade
                  que você quer cultivar.
                </p>
              </div>
            )}
            {data.routines.map((routine) => (
              <section
                className="routine"
                key={routine.id}
                aria-labelledby={`routine-${routine.id}`}
              >
                <div className="routine-heading">
                  <h3 id={`routine-${routine.id}`}>{routine.name}</h3>
                  <span>
                    {routine.activities.filter((a) => a.done).length}/
                    {routine.activities.length}
                  </span>
                </div>
                {routine.activities.length === 0 && (
                  <p className="hint">O que você quer fazer nesta rotina?</p>
                )}
                <ul>
                  {routine.activities.map((activity) => (
                    <li
                      key={activity.id}
                      className={activity.done ? "done" : ""}
                    >
                      <div>
                        <span className="activity-name">{activity.name}</span>
                        <span className="activity-points">
                          {activity.done
                            ? "10 pontos ganhos hoje"
                            : "+10 pontos"}
                        </span>
                      </div>
                      <form action={finishActivity}>
                        <input
                          type="hidden"
                          name="activityId"
                          value={activity.id}
                        />
                        <Submit disabled={activity.done}>
                          {activity.done ? "Concluída" : "Concluir"}
                        </Submit>
                      </form>
                    </li>
                  ))}
                </ul>
                <form
                  className="inline-form"
                  action={createActivity}
                  aria-labelledby={`add-${routine.id}`}
                >
                  <input type="hidden" name="routineId" value={routine.id} />
                  <label
                    id={`add-${routine.id}`}
                    htmlFor={`activity-${routine.id}`}
                  >
                    Adicionar atividade <span>(obrigatório)</span>
                  </label>
                  <div className="input-row">
                    <input
                      id={`activity-${routine.id}`}
                      name="name"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Ex.: caminhar por 15 minutos"
                    />
                    <Submit>Adicionar</Submit>
                  </div>
                </form>
              </section>
            ))}
            <form
              className="new-routine"
              action={createRoutine}
              aria-labelledby="new-title"
            >
              <h3 id="new-title">Cultive uma nova rotina</h3>
              <label htmlFor="routine-name">
                Nome da rotina <span>(obrigatório)</span>
              </label>
              <div className="input-row">
                <input
                  id="routine-name"
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Ex.: Minha manhã"
                />
                <Submit>Criar rotina</Submit>
              </div>
            </form>
          </section>
          <aside aria-labelledby="pet-title">
            <div className="pet-home">
              <div className="pet-label">
                <h2 id="pet-title">Seu companheiro</h2>
                <span className={`mood mood-${data.mood}`}>
                  {data.mood === "ok"
                    ? "De boa"
                    : data.mood === "feliz"
                      ? "Feliz"
                      : "Triste"}
                </span>
              </div>
              <div className="pet-scene">
                <Pet mood={data.mood} />
                <div className="ground" />
              </div>
              <h3>{moodCopy[data.mood]}</h3>
              <p>
                {data.total === 0
                  ? "Adicione sua primeira atividade para começarmos juntos."
                  : "Cada atividade concluída é um cuidado com você e com seu pet."}
              </p>
            </div>
            <section className="daily" aria-labelledby="today-title">
              <div className="section-title">
                <h2 id="today-title">Seu dia até aqui</h2>
                <strong>{progress}%</strong>
              </div>
              <progress
                value={data.done}
                max={Math.max(data.total, 1)}
                aria-label="Atividades concluídas hoje"
              />
              <p>
                {data.done} de {data.total} atividades concluídas
              </p>
              <small>
                O dia vira à meia-noite de São Paulo. Seus pontos ficam com
                você.
              </small>
            </section>
            <p className="gentle">
              Constância vale mais que perfeição.
              <br />
              Amanhã tem uma nova chance.
            </p>
          </aside>
        </div>
      </main>
      <footer>
        Rotina Pet <span>Um passo de cada vez.</span>
      </footer>
    </>
  );
}
