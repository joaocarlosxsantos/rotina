import { getDatabase } from "../db/client";
import { dashboard } from "../lib/store";
import {
  MAX_STREAK_BONUS,
  POINTS_PER_ACTIVITY,
  SKIP_PENALTY,
  TIME_ZONE,
} from "../lib/rules";
import {
  createActivity,
  createRoutine,
  finishActivity,
  passActivity,
} from "./actions";
import { Submit } from "./submit";
import { Pet } from "./pet";
import Link from "next/link";
import { RoutineFields, ActivityFields } from "./routine-fields";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const now = new Date();
  const data = await dashboard(await getDatabase(), now);
  const query = await searchParams;
  const progress = data.total ? Math.round((data.done / data.total) * 100) : 0;
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
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
        <nav aria-label="Principal">
          <Link href="/" aria-current="page">
            Hoje
          </Link>
          <Link href="/rotinas">Gerenciar rotinas</Link>
        </nav>
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
            <span>saldo de pontos</span>
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
              <h2 id="routines-title">Minhas rotinas de hoje</h2>
              <span>
                {data.routines.length}{" "}
                {data.routines.length === 1 ? "rotina" : "rotinas"}
              </span>
            </div>
            {data.routines.length === 0 && (
              <div className="empty">
                <h3>Seu dia está em aberto.</h3>
                <p>
                  Nenhuma rotina ativa prevista para hoje. Crie uma rotina
                  abaixo ou{" "}
                  <Link href="/rotinas">
                    ajuste os dias em Gerenciar rotinas
                  </Link>
                  .
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
                  <Link
                    className="manage-link"
                    href={`/rotinas#routine-${routine.id}`}
                  >
                    Editar e arquivar
                  </Link>
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
                      className={
                        activity.done
                          ? "done"
                          : activity.skipped
                            ? "skipped"
                            : ""
                      }
                    >
                      <div>
                        <span className="activity-name">{activity.name}</span>
                        {activity.scheduledTime && (
                          <time
                            className="schedule"
                            dateTime={activity.scheduledTime}
                          >
                            {activity.scheduledTime} · São Paulo
                          </time>
                        )}
                        <span className="activity-points">
                          {activity.skipped
                            ? `-${SKIP_PENALTY} pontos · pulada hoje`
                            : activity.done
                              ? `+${POINTS_PER_ACTIVITY} pontos${activity.bonus ? ` · +${activity.bonus} bônus` : ""}`
                              : `+${POINTS_PER_ACTIVITY} pontos`}
                        </span>
                      </div>
                      <form
                        action={finishActivity}
                        className="activity-actions"
                        aria-label={`Concluir ou pular ${activity.name}`}
                      >
                        <input
                          type="hidden"
                          name="activityId"
                          value={activity.id}
                        />
                        <Submit disabled={activity.done || activity.skipped}>
                          {activity.done
                            ? "Concluída"
                            : activity.skipped
                              ? "Pulada"
                              : "Concluir"}
                        </Submit>
                        {!activity.done && !activity.skipped && (
                          <Submit
                            formAction={passActivity}
                            className="skip-activity"
                          >
                            Pular (-{SKIP_PENALTY})
                          </Submit>
                        )}
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
                  <h4 id={`add-${routine.id}`}>Adicionar atividade</h4>
                  <ActivityFields prefix={`activity-${routine.id}`} />
                  <Submit>Adicionar</Submit>
                </form>
              </section>
            ))}
            <form
              className="new-routine"
              action={createRoutine}
              aria-labelledby="new-title"
            >
              <h3 id="new-title">Cultive uma nova rotina</h3>
              <RoutineFields prefix="home-new" />
              <Submit>Criar rotina</Submit>
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
            <section className="streak" aria-labelledby="streak-title">
              <h2 id="streak-title">Sequência atual</h2>
              <strong>
                {data.streak} {data.streak === 1 ? "dia" : "dias"}
              </strong>
              <p>
                Conclua ao menos uma atividade por dia. Cada conclusão rende +
                {POINTS_PER_ACTIVITY} pontos e até +{MAX_STREAK_BONUS} de bônus
                por sequência.
              </p>
              <p>
                Pular desconta até {SKIP_PENALTY} pontos. O saldo nunca fica
                negativo; pular não conta como conclusão.
              </p>
            </section>
            <p className="gentle">
              Constância vale mais que perfeição.
              <br />
              Amanhã tem uma nova chance.
            </p>
          </aside>
        </div>
        <section className="points-history" aria-labelledby="history-title">
          <h2 id="history-title">Histórico de pontos</h2>
          <p className="hint">
            Últimos 30 registros, do mais recente ao mais antigo. O desconto de
            -{SKIP_PENALTY} é limitado ao saldo disponível, sem gerar dívida.
          </p>
          {data.history.length === 0 ? (
            <p className="hint">
              Suas conclusões e atividades puladas aparecerão aqui.
            </p>
          ) : (
            <ol>
              {data.history.map((event) => (
                <li key={event.id}>
                  <div>
                    <time dateTime={event.day}>
                      {event.day.split("-").reverse().join("/")}
                    </time>
                    <strong>{event.activityName}</strong>
                    <span>
                      {event.status === "completed" ? "Concluída" : "Pulada"}
                    </span>
                  </div>
                  <div className="point-change">
                    <span>
                      {event.points >= 0 ? "+" : ""}
                      {event.points} pontos
                    </span>
                    {event.bonus > 0 && (
                      <span>+{event.bonus} bônus de sequência</span>
                    )}
                    <small>
                      Saldo: {event.balanceAfter.toLocaleString("pt-BR")}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
      <footer>
        Rotina Pet <span>Um passo de cada vez.</span>
      </footer>
    </>
  );
}
