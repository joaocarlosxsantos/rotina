import { requireCurrentUser } from "../../auth/server";
import { signOut } from "../../app/auth-actions";
import Link from "next/link";
import { getDatabase } from "../../db/client";
import { catalog } from "../../lib/store";
import { maskDays, WEEKDAYS } from "../../lib/rules";
import {
  createActivity,
  createRoutine,
  editActivity,
  editRoutine,
} from "../actions";
import { RoutineFields, ActivityFields } from "../routine-fields";
import { ArchiveForm } from "../archive-form";
import { Submit } from "../submit";
import { Logo } from "../brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Manage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireCurrentUser();
  const rows = await catalog(await getDatabase(), user);
  const query = await searchParams;
  const active = rows.filter((row) => row.archivedAt === null);
  const archived = rows.filter((row) => row.archivedAt !== null);
  return (
    <>
      <a className="skip" href="#gerenciar">
        Pular para gerenciar rotinas
      </a>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Rotina Pet">
          <Logo size={32} />
        </Link>
        <nav aria-label="Principal">
          <Link href="/">Hoje</Link>
          <Link href="/rotinas" aria-current="page">
            Gerenciar rotinas
          </Link>
          <form action={signOut}><button className="logout" type="submit">Sair</button></form>
        </nav>
      </header>
      <main className="manage" id="gerenciar">
        <div className="manage-intro">
          <h1>Sua rotina, do seu jeito.</h1>
          <p>
            Organize os dias, ajuste atividades e guarde o que já fez parte da
            sua jornada.
          </p>
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
        <section aria-labelledby="active-title">
          <h2 id="active-title">Todas as rotinas ativas</h2>
          {active.length === 0 && (
            <p className="empty">
              Você ainda não tem rotinas ativas. Crie uma abaixo.
            </p>
          )}
          {active.map((routine) => (
            <section
              className="routine managed-routine"
              key={routine.id}
              aria-labelledby={`routine-${routine.id}`}
            >
              <h3 id={`routine-${routine.id}`}>{routine.name}</h3>
              <p className="schedule">
                {maskDays(routine.weekdays)
                  .map((day) => WEEKDAYS[day])
                  .join(" · ")}
              </p>
              <details className="edit-panel">
                <summary>Editar rotina: {routine.name}</summary>
                <form
                  action={editRoutine}
                  aria-label={`Editar rotina ${routine.name}`}
                >
                  <input type="hidden" name="routineId" value={routine.id} />
                  <input type="hidden" name="returnTo" value="/rotinas" />
                  <RoutineFields
                    prefix={`edit-${routine.id}`}
                    name={routine.name}
                    days={maskDays(routine.weekdays)}
                  />
                  <Submit>Salvar rotina</Submit>
                </form>
              </details>
              <ul className="managed-activities">
                {routine.activities
                  .filter((activity) => activity.archivedAt === null)
                  .map((activity) => (
                    <li key={activity.id}>
                      <div className="managed-activity">
                        <h4>{activity.name}</h4>
                        <p className="schedule">
                          {activity.scheduledTime
                            ? `${activity.scheduledTime} · São Paulo`
                            : "Sem horário definido"}
                        </p>
                        <details className="edit-panel">
                          <summary>Editar atividade: {activity.name}</summary>
                          <form
                            action={editActivity}
                            aria-label={`Editar atividade ${activity.name}`}
                          >
                            <input
                              type="hidden"
                              name="activityId"
                              value={activity.id}
                            />
                            <input
                              type="hidden"
                              name="returnTo"
                              value="/rotinas"
                            />
                            <ActivityFields
                              prefix={`edit-${activity.id}`}
                              name={activity.name}
                              time={activity.scheduledTime}
                            />
                            <Submit>Salvar atividade</Submit>
                          </form>
                        </details>
                        <ArchiveForm
                          kind="activity"
                          id={activity.id}
                          name={activity.name}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
              <details className="edit-panel">
                <summary>Adicionar atividade em {routine.name}</summary>
                <form
                  action={createActivity}
                  aria-label={`Adicionar atividade em ${routine.name}`}
                >
                  <input type="hidden" name="routineId" value={routine.id} />
                  <input type="hidden" name="returnTo" value="/rotinas" />
                  <ActivityFields prefix={`new-${routine.id}`} />
                  <Submit>Adicionar atividade</Submit>
                </form>
              </details>
              <ArchiveForm kind="routine" id={routine.id} name={routine.name} />
              {routine.activities.some(
                (activity) => activity.archivedAt !== null,
              ) && (
                <details className="archived-list">
                  <summary>Atividades arquivadas desta rotina</summary>
                  <ul>
                    {routine.activities
                      .filter((activity) => activity.archivedAt !== null)
                      .map((activity) => (
                        <li key={activity.id}>
                          {activity.name}
                          {activity.scheduledTime
                            ? ` · ${activity.scheduledTime}`
                            : ""}{" "}
                          — arquivada
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </section>
          ))}
        </section>
        <form
          className="new-routine"
          action={createRoutine}
          aria-labelledby="new-title"
        >
          <h2 id="new-title">Criar uma rotina</h2>
          <input type="hidden" name="returnTo" value="/rotinas" />
          <RoutineFields prefix="manage-new" />
          <Submit>Criar rotina</Submit>
        </form>
        <section className="archive-section" aria-labelledby="archived-title">
          <h2 id="archived-title">Rotinas arquivadas</h2>
          <p className="hint">
            Permanecem guardadas com suas atividades. Não entram na agenda de
            hoje.
          </p>
          {archived.length === 0 ? (
            <p className="hint">Nenhuma rotina arquivada.</p>
          ) : (
            <ul>
              {archived.map((routine) => (
                <li key={routine.id}>
                  <h3>{routine.name}</h3>
                  <p className="schedule">
                    {maskDays(routine.weekdays)
                      .map((day) => WEEKDAYS[day])
                      .join(" · ")}
                  </p>
                  <ul>
                    {routine.activities.map((activity) => (
                      <li key={activity.id}>
                        {activity.name}
                        {activity.scheduledTime
                          ? ` · ${activity.scheduledTime}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <footer>
        Rotina Pet <span>Um passo de cada vez.</span>
      </footer>
    </>
  );
}
