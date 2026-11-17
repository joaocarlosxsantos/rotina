import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "../src/db/client";
import { activities, completions, routines } from "../src/db/schema";
import {
  addActivity,
  addRoutine,
  archiveActivity,
  archiveRoutine,
  catalog,
  completeActivity,
  dashboard,
  updateActivity,
  updateRoutine,
} from "../src/lib/store";
import {
  ALL_WEEKDAYS,
  dayKey,
  InputError,
  maskDays,
  validTime,
  validWeekdays,
  weekdaySP,
  weekdaysMask,
} from "../src/lib/rules";

async function withDatabase(
  work: (db: ReturnType<typeof createDatabase>["db"]) => Promise<void>,
) {
  const { client, db } = createDatabase("file::memory:");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await work(db);
  } finally {
    client.close();
  }
}

const tuesday = new Date("2026-11-17T14:00:00Z");
const wednesday = new Date("2026-11-18T14:00:00Z");

test("dias: aceita apenas inteiros 0 a 6 e ao menos um dia", () => {
  assert.deepEqual(validWeekdays(["6", "0", 2, 2]), [0, 2, 6]);
  assert.equal(weekdaysMask(ALL_WEEKDAYS), 127);
  assert.deepEqual(maskDays(weekdaysMask([0, 6])), [0, 6]);
  for (const value of [
    null,
    undefined,
    [],
    "1",
    [-1],
    [7],
    [1.5],
    [true],
    [null],
    [""],
    ["01"],
    [" 1"],
    ["1.0"],
    ["1e0"],
    ["1\n"],
    [NaN],
    Array(8).fill(1),
  ]) {
    assert.throws(() => validWeekdays(value), InputError);
  }
});

test("horário opcional: aceita HH:MM e rejeita horários e tipos inválidos", () => {
  for (const time of ["00:00", "09:05", "23:59"])
    assert.equal(validTime(time), time);
  assert.equal(validTime(null), null);
  assert.equal(validTime(""), null);
  for (const value of [
    undefined,
    930,
    false,
    "9:30",
    "24:00",
    "12:60",
    "12:30:00",
    " 09:00",
    "09:00 ",
    "ab:cd",
    "\n09:00",
    "09:00\n",
  ]) {
    assert.throws(() => validTime(value), InputError);
  }
});

test("dia de SP: virada de semana ignora o fuso do host e o dia UTC", () => {
  assert.equal(weekdaySP(new Date("2026-11-22T02:59:59Z")), 6);
  assert.equal(weekdaySP(new Date("2026-11-22T03:00:00Z")), 0);
  assert.equal(dayKey(new Date("2026-11-22T02:59:59Z")), "2026-11-21");
});

test("conclusão concorrente na Fase 2 grava apenas uma conclusão e 10 pontos", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Terça concorrente", [2]);
    const activity = await addActivity(db, routine.id, "Caminhar", "07:00");
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        completeActivity(db, activity.id, tuesday),
      ),
    );
    assert.deepEqual(results.toSorted(), [false, false, false, true]);
    const rows = await db.select().from(completions);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].activityId, activity.id);
    assert.equal(rows[0].day, "2026-11-17");
    assert.equal(rows[0].points, 10);
    const state = await dashboard(db, tuesday);
    assert.equal(state.done, 1);
    assert.equal(state.points, 10);
    assert.equal(state.mood, "feliz");
  });
});

test("virada 02:59Z/03:00Z em completeActivity troca o dia elegível e o dia gravado em SP", async () => {
  await withDatabase(async (db) => {
    const saturday = await addRoutine(db, "Sábado", [6]);
    const saturdayActivity = await addActivity(
      db,
      saturday.id,
      "Caminhar no sábado",
    );
    const sunday = await addRoutine(db, "Domingo", [0]);
    const sundayActivity = await addActivity(
      db,
      sunday.id,
      "Caminhar no domingo",
    );
    const before = new Date("2026-11-22T02:59:59Z");
    const after = new Date("2026-11-22T03:00:00Z");
    assert.equal(
      await completeActivity(db, saturdayActivity.id, before),
      true,
    );
    assert.equal(
      await completeActivity(db, saturdayActivity.id, before),
      false,
    );
    await assert.rejects(
      () => completeActivity(db, saturdayActivity.id, after),
      InputError,
    );
    assert.equal(
      await completeActivity(db, sundayActivity.id, after),
      true,
    );
    await assert.rejects(
      () => completeActivity(db, sundayActivity.id, before),
      InputError,
    );
    const rows = await db.select().from(completions);
    assert.equal(rows.length, 2);
    assert.equal(
      rows.find((row) => row.activityId === saturdayActivity.id)?.day,
      "2026-11-21",
    );
    assert.equal(
      rows.find((row) => row.activityId === sundayActivity.id)?.day,
      "2026-11-22",
    );
    assert.equal((await dashboard(db, before)).points, 21);
    assert.equal((await dashboard(db, after)).total, 1);
    assert.equal((await dashboard(db, after)).done, 1);
  });
});

test("agenda diária filtra rotina, herda dias nas atividades e ordena horário sem bloquear conclusão antecipada", async () => {
  await withDatabase(async (db) => {
    const today = await addRoutine(db, "Terça de cuidado", [2]);
    const tomorrow = await addRoutine(db, "Quarta de cuidado", [3]);
    const anytime = await addActivity(db, today.id, "Sem horário");
    const late = await addActivity(db, today.id, "Ler à noite", "23:59");
    const early = await addActivity(db, today.id, "Caminhar cedo", "07:00");
    const hidden = await addActivity(
      db,
      tomorrow.id,
      "Somente quarta",
      "08:00",
    );
    const state = await dashboard(db, tuesday);
    assert.deepEqual(
      state.routines.map((row) => row.id),
      [today.id],
    );
    assert.deepEqual(
      state.routines[0].activities.map((row) => row.id),
      [early.id, late.id, anytime.id],
    );
    assert.equal(state.total, 3);
    assert.equal(await completeActivity(db, late.id, tuesday), true);
    assert.equal((await dashboard(db, tuesday)).mood, "triste");
    await assert.rejects(
      () => completeActivity(db, hidden.id, tuesday),
      InputError,
    );
    const next = await dashboard(db, wednesday);
    assert.deepEqual(
      next.routines.map((row) => row.id),
      [tomorrow.id],
    );
    assert.equal(next.total, 1);
    assert.equal(next.done, 0);
    assert.equal(next.points, 10);
    const saturday = await addRoutine(db, "Sábado", [6]);
    assert.equal(
      (await dashboard(db, new Date("2026-11-22T02:59:59Z"))).routines[0].id,
      saturday.id,
    );
    assert.equal(
      (await dashboard(db, new Date("2026-11-22T03:00:00Z"))).total,
      0,
    );
  });
});

test("edição preserva IDs, conclusões e pontos, muda dias e permite retirar horário", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Minha rotina", [2]);
    const activity = await addActivity(db, routine.id, "Ler páginas", "08:00");
    await completeActivity(db, activity.id, tuesday);
    const changed = await updateActivity(
      db,
      activity.id,
      "  Ler um capítulo  ",
      "09:30",
    );
    assert.equal(changed.id, activity.id);
    assert.equal(changed.name, "Ler um capítulo");
    assert.equal(changed.scheduledTime, "09:30");
    assert.equal(await completeActivity(db, activity.id, tuesday), false);
    const cleared = await updateActivity(
      db,
      activity.id,
      "Ler um capítulo",
      "",
    );
    assert.equal(cleared.scheduledTime, null);
    const renamed = await updateRoutine(
      db,
      routine.id,
      "  Rotina revisada  ",
      [3, 6],
    );
    assert.equal(renamed.id, routine.id);
    assert.equal(renamed.name, "Rotina revisada");
    const today = await dashboard(db, tuesday);
    assert.equal(today.total, 0);
    assert.equal(today.done, 0);
    assert.equal(today.mood, "ok");
    assert.equal(today.points, 10);
    assert.equal(
      (await dashboard(db, wednesday)).routines[0].activities[0].id,
      activity.id,
    );
    const history = await db.select().from(completions);
    assert.equal(history.length, 1);
    assert.equal(history[0].activityId, activity.id);
    assert.equal(history[0].day, "2026-11-17");
  });
});

test("arquivar atividade e rotina não apaga linhas nem pontos e bloqueia mutações de arquivados", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Rotina arquivável");
    const first = await addActivity(db, routine.id, "Primeira atividade");
    const second = await addActivity(db, routine.id, "Segunda atividade");
    await completeActivity(db, first.id, tuesday);
    await archiveActivity(db, first.id);
    const active = await dashboard(db, tuesday);
    assert.equal(active.total, 1);
    assert.equal(active.done, 0);
    assert.equal(active.points, 10);
    assert.equal(active.routines[0].activities[0].id, second.id);
    await assert.rejects(
      () => completeActivity(db, first.id, tuesday),
      InputError,
    );
    await assert.rejects(
      () => updateActivity(db, first.id, "Novo nome", null),
      InputError,
    );
    await archiveRoutine(db, routine.id);
    const hidden = await dashboard(db, tuesday);
    assert.equal(hidden.routines.length, 0);
    assert.equal(hidden.total, 0);
    assert.equal(hidden.points, 10);
    assert.equal((await db.select().from(routines)).length, 1);
    assert.equal((await db.select().from(activities)).length, 2);
    assert.equal((await db.select().from(completions)).length, 1);
    const all = await catalog(db);
    assert.notEqual(all[0].archivedAt, null);
    assert.equal(all[0].activities.length, 2);
    assert.notEqual(
      all[0].activities.find((row) => row.id === first.id)!.archivedAt,
      null,
    );
    await assert.rejects(
      () => completeActivity(db, second.id, tuesday),
      InputError,
    );
    await assert.rejects(
      () => addActivity(db, routine.id, "Nova atividade"),
      InputError,
    );
    await assert.rejects(
      () => updateActivity(db, second.id, "Novo nome", null),
      InputError,
    );
    await assert.rejects(() => archiveActivity(db, second.id), InputError);
    await assert.rejects(
      () => updateRoutine(db, routine.id, "Novo nome", [2]),
      InputError,
    );
    await assert.rejects(() => archiveRoutine(db, routine.id), InputError);
  });
});

test("servidor rejeita nomes, IDs, dias e horários inválidos antes de alterar dados", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Rotina válida", [2]);
    const activity = await addActivity(
      db,
      routine.id,
      "Atividade válida",
      "09:00",
    );
    for (const name of ["a", "x".repeat(81), null, "Nome\nnovo"]) {
      await assert.rejects(
        () => updateRoutine(db, routine.id, name, [2]),
        InputError,
      );
      await assert.rejects(
        () => updateActivity(db, activity.id, name, null),
        InputError,
      );
    }
    for (const id of [
      "invalid",
      "12345678-1234-1234-8234-123456789abc",
      `${randomUUID()}\n`,
      randomUUID(),
    ]) {
      await assert.rejects(
        () => updateRoutine(db, id, "Nome válido", [2]),
        InputError,
      );
      await assert.rejects(() => archiveRoutine(db, id), InputError);
      await assert.rejects(
        () => updateActivity(db, id, "Nome válido", null),
        InputError,
      );
      await assert.rejects(() => archiveActivity(db, id), InputError);
    }
    await assert.rejects(() => addRoutine(db, "Outra rotina", []), InputError);
    await assert.rejects(
      () => updateRoutine(db, routine.id, "Novo nome", [7]),
      InputError,
    );
    await assert.rejects(
      () => addActivity(db, routine.id, "Novo nome", "24:00"),
      InputError,
    );
    await assert.rejects(
      () => updateActivity(db, activity.id, "Novo nome", "9:00"),
      InputError,
    );
    const all = await catalog(db);
    assert.equal(all.length, 1);
    assert.equal(all[0].name, "Rotina válida");
    assert.equal(all[0].activities[0].name, "Atividade válida");
    assert.equal(all[0].activities[0].scheduledTime, "09:00");
  });
});

test("migration incremental conserva dados da fase 1 e preenche todos os dias por padrão", async () => {
  const folder = await mkdtemp(join(tmpdir(), "rotina-migrations-"));
  const { client, db } = createDatabase("file::memory:");
  try {
    await mkdir(join(folder, "meta"));
    const journal = JSON.parse(
      await readFile("./drizzle/meta/_journal.json", "utf8"),
    );
    const first = journal.entries[0];
    await writeFile(
      join(folder, "meta", "_journal.json"),
      JSON.stringify({ ...journal, entries: [first] }),
    );
    await copyFile(
      `./drizzle/${first.tag}.sql`,
      join(folder, `${first.tag}.sql`),
    );
    await migrate(db, { migrationsFolder: folder });
    const routineId = randomUUID();
    const activityId = randomUUID();
    await client.execute({
      sql: "insert into routines(id,name,created_at) values(?,?,?)",
      args: [routineId, "Legada", 1],
    });
    await client.execute({
      sql: "insert into activities(id,routine_id,name,created_at) values(?,?,?,?)",
      args: [activityId, routineId, "Legada", 1],
    });
    await client.execute({
      sql: "insert into completions(id,activity_id,day,points) values(?,?,?,?)",
      args: [randomUUID(), activityId, "2026-11-17", 10],
    });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await migrate(db, { migrationsFolder: "./drizzle" });
    const migrated = await catalog(db);
    assert.equal(migrated[0].id, routineId);
    assert.equal(migrated[0].weekdays, 127);
    assert.equal(migrated[0].archivedAt, null);
    assert.equal(migrated[0].activities[0].scheduledTime, null);
    assert.equal(migrated[0].activities[0].archivedAt, null);
    const state = await dashboard(db, tuesday);
    assert.equal(state.points, 10);
    assert.equal(state.done, 1);
  } finally {
    client.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("script de migration rejeita produção e URL remota antes de abrir o banco", () => {
  const production = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/migrate.ts"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: "file:./data/never-production.db",
      },
    },
  );
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /Migration de producao bloqueada/);
  const remote = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/migrate.ts"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: "libsql://invalid.example",
      },
    },
  );
  assert.notEqual(remote.status, 0);
  assert.match(remote.stderr, /Migration remota bloqueada/);
});
