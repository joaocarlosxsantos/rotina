import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import {
  databaseConfiguration,
  configuredDatabase,
  createDatabase,
} from "../src/db/client";
import { migrationPlan } from "../src/db/migration-policy";

const pooled =
  "postgresql://test-user:test-only-secret@ep-fixture-pooler.neon.tech/app?sslmode=require";
const direct =
  "postgres://test-user:other-test-secret@ep-fixture.neon.tech/app?sslmode=require";

test("produção aceita DATABASE_URL ou POSTGRES_URL do Neon, com prioridade explícita", () => {
  assert.deepEqual(
    databaseConfiguration({ NODE_ENV: "production", DATABASE_URL: pooled }),
    { kind: "neon", url: pooled },
  );
  assert.deepEqual(
    databaseConfiguration({ VERCEL: "1", POSTGRES_URL: pooled }),
    { kind: "neon", url: pooled },
  );
  assert.equal(
    databaseConfiguration({
      NODE_ENV: "production",
      DATABASE_URL: direct,
      POSTGRES_URL: pooled,
    }).kind,
    "neon",
  );
  assert.deepEqual(
    databaseConfiguration({
      NODE_ENV: "production",
      DATABASE_URL: "",
      POSTGRES_URL: pooled,
    }),
    { kind: "neon", url: pooled },
  );
});

test("URL remota inválida, sem credenciais ou TLS desativado falha sem mostrar segredo", () => {
  for (const DATABASE_URL of [
    "https://user:secret@host.invalid",
    "postgres://fixture.neon.tech/app",
    "postgres://u:p@fixture.neon.tech",
    "postgres://u:p@other.invalid/app",
    `${pooled}#hidden`,
    "postgres://u:p@fixture.neon.tech/app?sslmode=disable",
    "postgres://u:p@fixture\n.neon.tech/app",
    "postgres://u:p@fixture.neon.tech/app?host=outside.invalid",
  ]) {
    assert.throws(
      () => databaseConfiguration({ NODE_ENV: "production", DATABASE_URL }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes(DATABASE_URL));
        assert.ok(!error.message.includes("test-only-secret"));
        return true;
      },
    );
  }
});

test("factory remota recebe a URL selecionada sem abrir rede e redige erros", async () => {
  const memory = await createDatabase();
  let calls = 0;
  try {
    const connection = await configuredDatabase(
      { VERCEL: "1", POSTGRES_URL: pooled },
      process.cwd(),
      async (url) => {
        calls++;
        assert.equal(url, pooled);
        return memory;
      },
    );
    assert.equal(connection, memory);
    assert.equal(calls, 1);
    await assert.rejects(
      () =>
        configuredDatabase(
          { NODE_ENV: "test", DATABASE_URL: pooled },
          process.cwd(),
          async () => {
            calls++;
            return memory;
          },
        ),
      /somente PGlite/,
    );
    assert.equal(calls, 1);
    await assert.rejects(
      () =>
        configuredDatabase(
          { NODE_ENV: "production", DATABASE_URL: pooled },
          process.cwd(),
          async () => {
            throw new Error(pooled);
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes(pooled));
        assert.ok(!error.message.includes("test-only-secret"));
        return true;
      },
    );
  } finally {
    await memory.close();
  }
});

test("Preview nunca migra e vercel-build só migra no ambiente Production", () => {
  for (const override of [undefined, "1"]) {
    assert.deepEqual(
      migrationPlan({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        DATABASE_URL: pooled,
        DATABASE_URL_UNPOOLED: direct,
        ALLOW_REMOTE_MIGRATE: override,
      }),
      { kind: "skip" },
    );
  }
  for (const VERCEL_ENV of [undefined, "development", "preview"])
    assert.deepEqual(
      migrationPlan({ npm_lifecycle_event: "vercel-build", VERCEL_ENV }),
      { kind: "skip" },
    );
  assert.throws(
    () => migrationPlan({ VERCEL: "1", VERCEL_ENV: "production" }),
    /Produção exige/,
  );
});

test("migration de deploy usa unpooled quando disponível; ambiente local exige autorização", () => {
  assert.deepEqual(
    migrationPlan({
      VERCEL: "1",
      VERCEL_ENV: "production",
      DATABASE_URL: pooled,
      DATABASE_URL_UNPOOLED: direct,
    }),
    { kind: "neon", url: direct },
  );
  assert.deepEqual(
    migrationPlan({
      VERCEL: "1",
      VERCEL_ENV: "production",
      POSTGRES_URL: pooled,
    }),
    { kind: "neon", url: pooled },
  );
  assert.throws(
    () => migrationPlan({ NODE_ENV: "production", DATABASE_URL: pooled }),
    /ALLOW_REMOTE_MIGRATE/,
  );
  assert.throws(
    () => migrationPlan({ VERCEL_ENV: "production", DATABASE_URL: pooled }),
    /ALLOW_REMOTE_MIGRATE/,
  );
  assert.deepEqual(
    migrationPlan({
      DATABASE_URL: pooled,
      DATABASE_URL_UNPOOLED: direct,
      ALLOW_REMOTE_MIGRATE: "1",
    }),
    { kind: "neon", url: direct },
  );
  assert.deepEqual(
    migrationPlan({ DATABASE_URL_UNPOOLED: direct, ALLOW_REMOTE_MIGRATE: "1" }),
    { kind: "neon", url: direct },
  );
  assert.equal(
    migrationPlan({ NODE_ENV: "test", DATABASE_URL: "memory://" }).kind,
    "pglite",
  );
});

test("CLI Preview e CLI bloqueada encerram sem rede nem vazamento de senha/URL", () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: pooled,
    DATABASE_URL_UNPOOLED: direct,
    POSTGRES_URL: "",
    VERCEL: "",
    npm_lifecycle_event: "db:migrate",
    ALLOW_REMOTE_MIGRATE: "",
  };
  const preview = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/migrate.ts"],
    {
      encoding: "utf8",
      env: { ...env, VERCEL_ENV: "preview", ALLOW_REMOTE_MIGRATE: "1" },
      timeout: 10_000,
    },
  );
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /Migration ignorada/);
  const blocked = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/migrate.ts"],
    {
      encoding: "utf8",
      env: { ...env, VERCEL: undefined, VERCEL_ENV: undefined },
      timeout: 10_000,
    },
  );
  assert.notEqual(blocked.status, 0);
  for (const result of [preview, blocked])
    for (const secret of [
      pooled,
      direct,
      "test-only-secret",
      "other-test-secret",
    ])
      assert.ok(!`${result.stdout}${result.stderr}`.includes(secret));
});
