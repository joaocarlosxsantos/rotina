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
import { completions } from "../src/db/schema";
import { withDatabase } from "./helpers";

test("há uma migration inicial Postgres e ela é idempotente sem alterar dados", async () => {
  const journal = JSON.parse(
    await readFile("drizzle/meta/_journal.json", "utf8"),
  );
  assert.equal(journal.dialect, "postgresql");
  assert.equal(journal.entries.length, 1);
  const connection = await createDatabase();
  try {
    await migrateDatabase(connection);
    const routine = await addRoutine(connection.db, "Preservada");
    const activity = await addActivity(connection.db, routine.id, "Preservada");
    await completeActivity(
      connection.db,
      activity.id,
      new Date("2026-11-17T14:00:00Z"),
    );
    await migrateDatabase(connection);
    const state = await dashboard(
      connection.db,
      new Date("2026-11-17T14:00:00Z"),
    );
    assert.equal(state.points, 10);
    assert.equal(state.routines[0].id, routine.id);
    const rows = await connection.db.execute<{ count: number }>(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    assert.equal(rows.rows[0].count, 1);
  } finally {
    await connection.close();
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
    const broken = {
      ...original,
      idx: 1,
      when: original.when + 1,
      tag: "0001_broken",
    };
    await mkdir(join(folder, "meta"));
    await writeFile(
      join(folder, "meta", "_journal.json"),
      JSON.stringify({ ...journal, entries: [original, broken] }),
    );
    await copyFile(
      `drizzle/${original.tag}.sql`,
      join(folder, `${original.tag}.sql`),
    );
    await writeFile(
      join(folder, "0001_broken.sql"),
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
    assert.equal(journalRows.rows[0].count, 1);
  } finally {
    await connection.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("Postgres garante índice único atividade/dia, ordem, piso, bônus e referência", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, "Integridade");
    const activity = await addActivity(db, routine.id, "Integridade");
    await completeActivity(db, activity.id, new Date("2026-11-17T14:00:00Z"));
    const base = {
      id: randomUUID(),
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
    const routine = await addRoutine(db, "Continua funcionando");
    const activity = await addActivity(
      db,
      routine.id,
      "Concluir após rollback",
    );
    assert.equal(
      await completeActivity(db, activity.id, new Date("2026-11-17T14:00:00Z")),
      true,
    );
    assert.equal(
      (await dashboard(db, new Date("2026-11-17T14:00:00Z"))).routines.length,
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
      assert.equal(result.rows[0].count, 1);
    } finally {
      await connection.close();
    }
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
