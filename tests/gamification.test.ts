import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "../src/db/client";
import { completions } from "../src/db/schema";
import {
  addActivity,
  addRoutine,
  archiveActivity,
  archiveRoutine,
  completeActivity,
  dashboard,
  skipActivity,
} from "../src/lib/store";
import {
  currentStreak,
  InputError,
  previousDay,
  skipMessage,
} from "../src/lib/rules";

const today = new Date("2026-11-17T14:00:00Z");
const DRIZZLE_DIR = resolve("drizzle");

async function tempProject() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "rotina-phase3-")));
  await cp(DRIZZLE_DIR, join(root, "drizzle"), { recursive: true });
  return root;
}

async function cleanup(root: string) {
  // O driver sqlite3 libera o arquivo alguns ticks apos close(); no Windows
  // o unlink imediato falha com EBUSY, entao tentamos de novo com pausa curta.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await rm(root, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 19) throw error;
      await new Promise<void>((done) => setTimeout(done, 200));
    }
  }
}

function runMigrate(root: string, env: Record<string, string> = {}) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(resolve("node_modules/tsx/dist/loader.mjs")).href,
      resolve("scripts/migrate.ts"),
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: "file:./data/test.db",
        ...env,
      },
    },
  );
}

async function backupFiles(root: string) {
  return (await readdir(join(root, "data"))).filter(
    (file) => file.startsWith("test.db.backup-") && file.endsWith(".db"),
  );
}

const PHASE2_SEED = [
  "INSERT INTO routines(id,name,created_at) VALUES('11111111-1111-4111-8111-111111111111','Rotina da Fase 2',1);",
  "INSERT INTO activities(id,routine_id,name,created_at) VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Atividade da Fase 2',1);",
  "INSERT INTO completions(id,activity_id,day,points) VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','2026-11-16',10);",
].join("\n--> statement-breakpoint\n");

async function seedPhase2(root: string) {
  const folder = join(root, "drizzle");
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries: Array<{ tag: string }>;
  };
  const secondSql = join(folder, `${journal.entries[1].tag}.sql`);
  await writeFile(
    secondSql,
    `${await readFile(secondSql, "utf8")}\n--> statement-breakpoint\n${PHASE2_SEED}`,
  );
  await writeFile(
    journalPath,
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, 2) }),
  );
  const seed = runMigrate(root);
  assert.equal(seed.status, 0, seed.stderr);
  for (const file of await backupFiles(root))
    await rm(join(root, "data", file), { force: true });
  await writeFile(journalPath, JSON.stringify(journal));
}


test("script cria backup com os dados da Fase 2 e sem a coluna balance_after", async () => {
  const root = await tempProject();
  try {
    await seedPhase2(root);
    const result = runMigrate(root);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.indexOf("Backup SQLite local criado") <
        result.stdout.indexOf("Migrations aplicadas"),
    );
    const backups = await backupFiles(root);
    assert.equal(backups.length, 1);
    const backup = await readFile(join(root, "data", backups[0]));
    assert.equal(backup.subarray(0, 16).toString(), "SQLite format 3\u0000");
    assert.ok(backup.includes(Buffer.from("Rotina da Fase 2")));
    assert.ok(backup.includes(Buffer.from("Atividade da Fase 2")));
    assert.equal(backup.includes(Buffer.from("balance_after")), false);
    assert.equal(backup.includes(Buffer.from("event_order")), false);

    const migrated = await readFile(join(root, "data", "test.db"));
    assert.ok(migrated.includes(Buffer.from("balance_after")));
    assert.ok(migrated.includes(Buffer.from("event_order")));
    assert.ok(migrated.includes(Buffer.from("Rotina da Fase 2")));
  } finally {
    await cleanup(root);
  }
});

test("falha de backup impede a migration e deixa o banco intacto", async () => {
  const root = await tempProject();
  try {
    await mkdir(join(root, "data"), { recursive: true });
    const dbPath = join(root, "data", "test.db");
    const corrupt = Buffer.from("isto nao e um banco SQLite valido");
    await writeFile(dbPath, corrupt);
    const result = runMigrate(root);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Backup do banco falhou; migration cancelada/,
    );
    assert.deepEqual(await readFile(dbPath), corrupt);
    assert.equal((await backupFiles(root)).length, 0);
  } finally {
    await cleanup(root);
  }
});

test("nao cria backup quando nao ha migration pendente", async () => {
  const root = await tempProject();
  try {
    const first = runMigrate(root);
    assert.equal(first.status, 0, first.stderr);
    assert.equal((await backupFiles(root)).length, 1);
    const second = runMigrate(root);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.stdout.includes("Backup SQLite local criado"), false);
    assert.equal((await backupFiles(root)).length, 1);
  } finally {
    await cleanup(root);
  }
});

test("mantem somente os cinco backups mais recentes", async () => {
  const root = await tempProject();
  try {
    await seedPhase2(root);
    const dummies = Array.from(
      { length: 7 },
      (_, index) => `test.db.backup-${1700000000000 + index}-0000000${index}.db`,
    );
    for (const file of dummies)
      await writeFile(join(root, "data", file), "");
    const result = runMigrate(root);
    assert.equal(result.status, 0, result.stderr);
    const backups = (await backupFiles(root)).sort();
    assert.equal(backups.length, 5);
    for (const removed of dummies.slice(0, 3))
      assert.equal(backups.includes(removed), false);
    for (const kept of dummies.slice(3)) assert.ok(backups.includes(kept));
  } finally {
    await cleanup(root);
  }
});

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

test("pular desconta 5 uma vez, nunca cria dívida e exclui conclusão no mesmo dia", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Cuidados diários");
    const acts = await Promise.all(
      ["Ler", "Caminhar", "Alongar", "Meditar", "Beber água"].map((name) =>
        addActivity(db, routine.id, name),
      ),
    );
    await completeActivity(db, acts[0].id, today);
    assert.equal(await skipActivity(db, acts[1].id, today), true);
    assert.equal((await dashboard(db, today)).points, 5);
    assert.equal(await skipActivity(db, acts[1].id, today), false);
    assert.equal(skipMessage(false), "Já pulada hoje");
    await assert.rejects(
      () => completeActivity(db, acts[1].id, today),
      /já pulada hoje/,
    );
    await assert.rejects(
      () => skipActivity(db, acts[0].id, today),
      /já concluída hoje/,
    );
    await skipActivity(db, acts[2].id, today);
    assert.equal((await dashboard(db, today)).points, 0);
    await skipActivity(db, acts[3].id, today);
    assert.equal((await dashboard(db, today)).points, 0);
    await completeActivity(db, acts[4].id, today);
    const state = await dashboard(db, today);
    assert.equal(state.points, 10, "descontos no piso zero não viram dívida");
    assert.equal(state.done, 2);
    assert.equal(state.total, 5);
    assert.equal(
      state.mood,
      "ok",
      "40% de conclusões; puladas permanecem no denominador",
    );
    assert.equal(state.history.length, 5);
    assert.deepEqual(
      state.history.map((row) => row.balanceAfter),
      [10, 0, 0, 5, 10],
    );
    assert.equal(
      state.history.filter((row) => row.status === "skipped").length,
      3,
    );
    assert.ok(
      state.history
        .filter((row) => row.status === "skipped")
        .every((row) => row.points === -5 && row.bonus === 0),
    );
    assert.equal(
      state.routines[0].activities.find((row) => row.id === acts[1].id)!
        .skipped,
      true,
    );
  });
});

test("Promise.all de concluir e pular tem um único vencedor e uma única linha diária", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Concorrência");
    const activity = await addActivity(db, routine.id, "Atividade disputada");
    const results = await Promise.all([
      completeActivity(db, activity.id, today).catch((error) => error),
      skipActivity(db, activity.id, today).catch((error) => error),
    ]);
    assert.equal(results.filter((result) => result === true).length, 1);
    assert.equal(
      results.filter((result) => result instanceof InputError).length,
      1,
    );
    const rows = await db.select().from(completions);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].eventOrder, 1);
    const state = await dashboard(db, today);
    assert.equal(state.points, rows[0].status === "completed" ? 10 : 0);
    assert.equal(state.done, rows[0].status === "completed" ? 1 : 0);
    assert.equal(state.history.length, 1);
  });
});

test("Promise.all de pulos repetidos e de várias atividades não repete descontos nem perde saldo", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Pulos concorrentes");
    const earned = await addActivity(db, routine.id, "Concluída primeiro");
    const acts = await Promise.all(
      ["Pular primeira", "Pular segunda", "Pular terceira"].map((name) =>
        addActivity(db, routine.id, name),
      ),
    );
    await completeActivity(db, earned.id, today);
    const result = await Promise.all([
      skipActivity(db, acts[0].id, today),
      skipActivity(db, acts[0].id, today),
    ]);
    assert.deepEqual(result.toSorted(), [false, true]);
    await Promise.all(
      acts.slice(1).map((activity) => skipActivity(db, activity.id, today)),
    );
    const state = await dashboard(db, today);
    assert.equal(state.points, 0);
    assert.equal(state.history.length, 4);
    assert.deepEqual(
      state.history.map((row) => row.eventOrder),
      [4, 3, 2, 1],
    );
    assert.deepEqual(
      state.history.map((row) => row.balanceAfter),
      [0, 0, 5, 10],
    );
  });
});

test("Promise.all de conclusões aplica bônus por conclusão uma única vez, sem perder créditos", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Créditos concorrentes");
    const first = await addActivity(db, routine.id, "Primeira");
    const second = await addActivity(db, routine.id, "Segunda");
    await completeActivity(db, first.id, new Date("2026-11-16T14:00:00Z"));
    const results = await Promise.all([
      completeActivity(db, first.id, today),
      completeActivity(db, second.id, today),
      completeActivity(db, first.id, today),
      completeActivity(db, second.id, today),
    ]);
    assert.equal(results.filter(Boolean).length, 2);
    const state = await dashboard(db, today);
    assert.equal(state.points, 32);
    assert.equal(state.streak, 2);
    assert.equal(state.history.length, 3);
    assert.deepEqual(
      state.history.slice(0, 2).map((row) => row.bonus),
      [1, 1],
    );
    assert.deepEqual(
      state.history.map((row) => row.balanceAfter),
      [32, 21, 10],
    );
    assert.equal(state.mood, "feliz");
  });
});

test("sequência conta dias distintos, bônus cresce até 5 e arquivar preserva histórico", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Sequência longa");
    const first = await addActivity(db, routine.id, "Uma conclusão por dia");
    const second = await addActivity(
      db,
      routine.id,
      "Outra conclusão no mesmo dia",
    );
    const bonuses = [];
    for (let index = 0; index < 8; index++) {
      const now = new Date(Date.UTC(2026, 10, 10 + index, 14));
      await completeActivity(db, first.id, now);
      const state = await dashboard(db, now);
      bonuses.push(state.history[0].bonus);
      assert.equal(state.streak, index + 1);
    }
    assert.deepEqual(bonuses, [0, 1, 2, 3, 4, 5, 5, 5]);
    assert.equal((await dashboard(db, today)).points, 105);
    await completeActivity(db, second.id, today);
    assert.equal(await completeActivity(db, second.id, today), false);
    const state = await dashboard(db, today);
    assert.equal(state.streak, 8);
    assert.equal(state.points, 120);
    assert.equal(state.history[0].bonus, 5);
    await archiveRoutine(db, routine.id);
    const archived = await dashboard(db, today);
    assert.equal(archived.streak, 8);
    assert.equal(archived.points, 120);
    assert.equal(archived.history.length, 9);
    assert.equal(archived.total, 0);
  });
});

test("pular não apaga sequência, mas um dia sem conclusão quebra o próximo bônus", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Dias consecutivos");
    const first = await addActivity(db, routine.id, "Primeira");
    const second = await addActivity(db, routine.id, "Segunda");
    const day1 = new Date("2026-11-14T14:00:00Z");
    const day2 = new Date("2026-11-15T14:00:00Z");
    const day3 = new Date("2026-11-16T14:00:00Z");
    await completeActivity(db, first.id, day1);
    await skipActivity(db, first.id, day2);
    assert.equal((await dashboard(db, day2)).streak, 1);
    await completeActivity(db, second.id, day2);
    assert.equal((await dashboard(db, day2)).streak, 2);
    assert.equal((await dashboard(db, day2)).history[0].bonus, 1);
    await skipActivity(db, first.id, day3);
    assert.equal((await dashboard(db, day3)).streak, 2);
    assert.equal((await dashboard(db, today)).streak, 0);
    await completeActivity(db, first.id, today);
    const state = await dashboard(db, today);
    assert.equal(state.streak, 1);
    assert.equal(state.history[0].bonus, 0);
    assert.equal(state.points, 21);
  });
});

test("02:59Z e 03:00Z usam dias SP diferentes para exclusividade e bônus", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Virada de dia");
    const first = await addActivity(db, routine.id, "Primeira");
    const second = await addActivity(db, routine.id, "Segunda");
    const before = new Date("2026-11-18T02:59:00Z");
    const after = new Date("2026-11-18T03:00:00Z");
    await completeActivity(db, first.id, before);
    assert.equal(await completeActivity(db, first.id, before), false);
    assert.equal(await skipActivity(db, first.id, after), true);
    await completeActivity(db, second.id, after);
    const state = await dashboard(db, after);
    assert.equal(state.points, 16);
    assert.equal(state.streak, 2);
    assert.deepEqual(
      state.history.map((row) => row.day),
      ["2026-11-18", "2026-11-18", "2026-11-17"],
    );
    assert.equal(state.history[0].bonus, 1);
    assert.equal(
      await skipActivity(db, first.id, new Date("2026-11-19T02:59:00Z")),
      false,
    );
    await completeActivity(db, first.id, new Date("2026-11-19T03:00:00Z"));
    const next = await dashboard(db, new Date("2026-11-19T03:00:00Z"));
    assert.equal(next.streak, 3);
    assert.equal(next.history[0].bonus, 2);
    assert.equal(next.points, 28);
  });
});

test("pular valida UUID v4 e rejeita item arquivado ou fora da agenda sem gravar pontos", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Somente terça", [2]);
    const first = await addActivity(db, routine.id, "Primeira");
    const second = await addActivity(db, routine.id, "Segunda");
    for (const id of [
      null,
      "invalid",
      "12345678-1234-1234-8234-123456789abc",
      `${randomUUID()}\n`,
      randomUUID(),
    ]) {
      await assert.rejects(() => skipActivity(db, id, today), InputError);
    }
    await assert.rejects(
      () => skipActivity(db, first.id, new Date("2026-11-18T14:00:00Z")),
      InputError,
    );
    await archiveActivity(db, first.id);
    await assert.rejects(() => skipActivity(db, first.id, today), InputError);
    await archiveRoutine(db, routine.id);
    await assert.rejects(() => skipActivity(db, second.id, today), InputError);
    assert.equal((await db.select().from(completions)).length, 0);
    assert.equal((await dashboard(db, today)).points, 0);
  });
});

test("sequência atual ancora hoje ou ontem, considera ano/bissexto e ignora datas futuras", () => {
  assert.equal(currentStreak([], "2026-11-17"), 0);
  assert.equal(currentStreak(["2026-11-18"], "2026-11-17"), 0);
  assert.equal(
    currentStreak(["2026-11-15", "2026-11-16", "2026-11-16"], "2026-11-17"),
    2,
  );
  assert.equal(
    currentStreak(["2026-11-14", "2026-11-16", "2026-11-17"], "2026-11-17"),
    2,
  );
  assert.equal(currentStreak(["2025-12-31", "2026-01-01"], "2026-01-01"), 2);
  assert.equal(previousDay("2024-03-01"), "2024-02-29");
});

test("migration da Fase 2 preserva múltiplas conclusões, saldo e sequência sem bônus retroativo", async () => {
  const folder = await mkdtemp(join(tmpdir(), "rotina-phase3-migration-"));
  const { client, db } = createDatabase("file::memory:");
  try {
    const journal = JSON.parse(
      await readFile("./drizzle/meta/_journal.json", "utf8"),
    );
    await mkdir(join(folder, "meta"));
    await writeFile(
      join(folder, "meta", "_journal.json"),
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, 2) }),
    );
    for (const entry of journal.entries.slice(0, 2))
      await copyFile(
        `./drizzle/${entry.tag}.sql`,
        join(folder, `${entry.tag}.sql`),
      );
    await migrate(db, { migrationsFolder: folder });
    const routineId = randomUUID();
    const firstId = randomUUID();
    const secondId = randomUUID();
    await client.execute({
      sql: "insert into routines(id,name,created_at) values(?,?,?)",
      args: [routineId, "Legada", 1],
    });
    for (const id of [firstId, secondId])
      await client.execute({
        sql: "insert into activities(id,routine_id,name,created_at) values(?,?,?,?)",
        args: [id, routineId, "Legada", 1],
      });
    for (const [activityId, day] of [
      [firstId, "2026-11-15"],
      [firstId, "2026-11-16"],
      [secondId, "2026-11-16"],
    ]) {
      await client.execute({
        sql: "insert into completions(id,activity_id,day,points) values(?,?,?,?)",
        args: [randomUUID(), activityId, day, 10],
      });
    }
    await migrate(db, { migrationsFolder: "./drizzle" });
    await migrate(db, { migrationsFolder: "./drizzle" });
    const state = await dashboard(db, today);
    assert.equal(state.points, 30);
    assert.equal(state.streak, 2);
    assert.deepEqual(
      state.history.map((row) => row.balanceAfter),
      [30, 20, 10],
    );
    assert.deepEqual(
      state.history.map((row) => row.eventOrder),
      [3, 2, 1],
    );
    assert.ok(
      state.history.every(
        (row) => row.bonus === 0 && row.status === "completed",
      ),
    );
    await completeActivity(db, firstId, today);
    const next = await dashboard(db, today);
    assert.equal(next.points, 42);
    assert.equal(next.streak, 3);
    assert.equal(next.history[0].bonus, 2);
    assert.equal(next.history[0].eventOrder, 4);
  } finally {
    client.close();
    await rm(folder, { recursive: true, force: true });
  }
});
