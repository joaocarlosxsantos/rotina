import { TEST_USER } from "./helpers";
import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  copyFile,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../src/db/client";
import { migrateDatabase } from "../src/db/migrations";
import {
  addRoutine,
  addActivity,
  completeActivity,
  dashboard,
} from "../src/lib/store";
import { completions, routines, activities } from "../src/db/schema";
import { catalog } from "../src/lib/store";
import { withDatabase } from "./helpers";

test("há uma migration inicial Postgres e ela é idempotente sem alterar dados", async () => {
  const journal = JSON.parse(
    await readFile("drizzle/meta/_journal.json", "utf8"),
  );
  assert.equal(journal.dialect, "postgresql");
  assert.equal(journal.entries.length, 4);
  const connection = await createDatabase();
  try {
    await migrateDatabase(connection);
    const routine = await addRoutine(connection.db, TEST_USER, "Preservada");
    const activity = await addActivity(connection.db, TEST_USER, routine.id, "Preservada");
    await completeActivity(
      connection.db, TEST_USER,
      activity.id,
      new Date("2026-11-17T14:00:00Z"),
    );
    await migrateDatabase(connection);
    const state = await dashboard(
      connection.db, TEST_USER,
      new Date("2026-11-17T14:00:00Z"),
    );
    assert.equal(state.points, 10);
    assert.equal(state.routines[0].id, routine.id);
    const rows = await connection.db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    assert.equal(rows.rows[0].count, 4);
  } finally {
    await connection.close();
  }
});

test("migration de isolamento preserva dados antigos como órfãos inacessíveis", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pg-legacy-isolation-"));
  const connection = await createDatabase();
  try {
    const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
    const initial = journal.entries[0];
    await mkdir(join(folder, "meta"));
    await writeFile(join(folder, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: [initial] }));
    await copyFile(`drizzle/${initial.tag}.sql`, join(folder, `${initial.tag}.sql`));
    await migrateDatabase(connection, folder);
    const r = randomUUID(), a = randomUUID(), c = randomUUID();
    await connection.db.execute(sql`insert into routines(id,name) values(${r}::uuid, 'Antiga')`);
    await connection.db.execute(sql`insert into activities(id,routine_id,name) values(${a}::uuid, ${r}::uuid, 'Antiga')`);
    await connection.db.execute(sql`insert into completions(id,activity_id,day,points,status,bonus,event_order,balance_after) values(${c}::uuid, ${a}::uuid, '2026-11-17', 10, 'completed', 0, 1, 10)`);
    await migrateDatabase(connection);
    assert.equal((await connection.db.select().from(routines))[0].userId, null);
    assert.equal((await connection.db.select().from(activities))[0].userId, null);
    const saved = (await connection.db.select().from(completions))[0];
    assert.equal(saved.userId, null); assert.equal(saved.balanceAfter, 10); assert.equal(saved.id, c);
    assert.deepEqual(await catalog(connection.db, TEST_USER), []);
    const state = await dashboard(connection.db, TEST_USER, new Date("2026-11-17T14:00:00Z"));
    assert.equal(state.points, 0); assert.deepEqual(state.history, []);
    await assert.rejects(() => addActivity(connection.db, TEST_USER, r, "Não assumir"));
    await assert.rejects(() => completeActivity(connection.db, TEST_USER, a));
  } finally {
    await connection.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("falha em migration Postgres reverte DDL e não avança o journal", async () => {
  const folder = await mkdtemp(join(tmpdir(), "pg-migration-failure-"));
  const connection = await createDatabase();
  try {
    await migrateDatabase(connection);
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    const original = journal.entries[0];
    const brokenTag = `000${journal.entries.length}_broken`;
    const broken = {
      ...original,
      idx: journal.entries.length,
      when: journal.entries[journal.entries.length - 1].when + 1,
      tag: brokenTag,
    };
    await mkdir(join(folder, "meta"));
    await writeFile(
      join(folder, "meta", "_journal.json"),
      JSON.stringify({ ...journal, entries: [...journal.entries, broken] }),
    );
    for (const entry of journal.entries) {
      await copyFile(
        `drizzle/${entry.tag}.sql`,
        join(folder, `${entry.tag}.sql`),
      );
    }
    await writeFile(
      join(folder, `${brokenTag}.sql`),
      "create table rollback_probe(id integer);--> statement-breakpoint\ninsert into table_that_does_not_exist values(1);",
    );
    await assert.rejects(() => migrateDatabase(connection, folder));
    const probe = await connection.db.execute<{ name: string | null }>(
      sql`select to_regclass('public.rollback_probe')::text as name`,
    );
    assert.equal(probe.rows[0].name, null);
    const journalRows = await connection.db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    assert.equal(journalRows.rows[0].count, journal.entries.length);
  } finally {
    await connection.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("Postgres garante índice único atividade/dia, ordem, piso, bônus e referência", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, TEST_USER, "Integridade");
    const activity = await addActivity(db, TEST_USER, routine.id, "Integridade");
    await completeActivity(db, TEST_USER, activity.id, new Date("2026-11-17T14:00:00Z"));
    const base = {
      id: randomUUID(),
      userId: TEST_USER.id,
      activityId: activity.id,
      day: "2026-11-17",
      points: -5,
      status: "skipped" as const,
      bonus: 0,
      eventOrder: 2,
      balanceAfter: 5,
    };
    await assert.rejects(() => db.insert(completions).values(base));
    await assert.rejects(() =>
      db
        .insert(completions)
        .values({ ...base, day: "2026-11-18", eventOrder: 1 }),
    );
    await assert.rejects(() =>
      db
        .insert(completions)
        .values({ ...base, day: "2026-11-18", balanceAfter: -1 }),
    );
    await assert.rejects(() =>
      db.insert(completions).values({ ...base, day: "2026-11-18", bonus: 6 }),
    );
    await assert.rejects(() =>
      db
        .insert(completions)
        .values({ ...base, activityId: randomUUID(), day: "2026-11-18" }),
    );
    assert.equal((await db.select().from(completions)).length, 1);
  });
});

test("transação de lançamento desfaz alterações e libera lock após erro", async () => {
  await withDatabase(async (db) => {
    await assert.rejects(() =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(724681, 1)`);
        await tx.execute(
          sql`insert into routines(id, name, weekdays) values(${randomUUID()}::uuid, 'Não deve persistir', 127)`,
        );
        throw new Error("rollback intencional");
      }),
    );
    const routine = await addRoutine(db, TEST_USER, "Continua funcionando");
    const activity = await addActivity(
      db, TEST_USER,
      routine.id,
      "Concluir após rollback",
    );
    assert.equal(
      await completeActivity(db, TEST_USER, activity.id, new Date("2026-11-17T14:00:00Z")),
      true,
    );
    assert.equal(
      (await dashboard(db, TEST_USER, new Date("2026-11-17T14:00:00Z"))).routines.length,
      1,
    );
  });
});

test("CLI aplica migration em PGlite local e repete sem mudar o journal", async () => {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  const folder = await mkdtemp(join(process.cwd(), "data", "pg-cli-test-"));
  try {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      VERCEL: undefined,
      VERCEL_ENV: undefined,
      DATABASE_URL: `pglite:${join(folder, "database")}`,
      DATABASE_URL_UNPOOLED: "",
      POSTGRES_URL: "",
      ALLOW_REMOTE_MIGRATE: "",
      npm_lifecycle_event: "db:migrate",
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "scripts/migrate.ts"],
        { encoding: "utf8", env, timeout: 30_000 },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Migrations Postgres concluídas/);
    }
    const connection = await createDatabase(
      `pglite:${join(folder, "database")}`,
    );
    try {
      const result = await connection.db.execute<{ count: number }>(
        sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
      );
      assert.equal(result.rows[0].count, 4);
    } finally {
      await connection.close();
    }
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
