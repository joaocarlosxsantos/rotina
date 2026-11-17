import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { createClient } from "@libsql/client";
import {
  configuredDatabase,
  createDatabase,
  databaseConfiguration,
} from "../src/db/client";
import { migrationPlan } from "../src/db/migration-policy";

const remote = {
  DATABASE_URL: "libsql://policy-fixture.invalid",
  DATABASE_AUTH_TOKEN: "test-only-placeholder",
};

test("factory de baixo nível também bloqueia remoto em dev/teste antes de criar conexão", () => {
  let calls = 0;
  const forbiddenFactory: typeof createClient = () => {
    calls += 1;
    throw new Error("não deveria criar conexão");
  };
  for (const NODE_ENV of ["development", "test"]) {
    assert.throws(
      () =>
        createDatabase(
          remote.DATABASE_URL,
          remote.DATABASE_AUTH_TOKEN,
          forbiddenFactory,
          { NODE_ENV },
        ),
      /apenas SQLite local/,
    );
    assert.throws(
      () =>
        createDatabase(
          "https://blocked.invalid",
          remote.DATABASE_AUTH_TOKEN,
          forbiddenFactory,
          { NODE_ENV },
        ),
      /apenas SQLite local/,
    );
  }
  assert.equal(calls, 0);
});

test("dev/teste mantêm SQLite local e recusam libsql mesmo com token ou flag de migration", () => {
  for (const NODE_ENV of [undefined, "development", "test"]) {
    assert.deepEqual(databaseConfiguration({ NODE_ENV }), {
      kind: "local",
      url: "file:./data/rotina.db",
    });
    assert.throws(
      () =>
        databaseConfiguration({
          ...remote,
          NODE_ENV,
          ALLOW_REMOTE_MIGRATE: "1",
        }),
      /apenas SQLite local/,
    );
  }
  assert.throws(
    () => databaseConfiguration({ DATABASE_URL: "file:../escape.db" }),
    /nao e permitido/,
  );
  assert.throws(
    () => databaseConfiguration({ DATABASE_URL: "file::memory:" }),
    /memoria/,
  );
});

test("libsql com token é permitido somente por VERCEL definido ou NODE_ENV=production", () => {
  for (const env of [
    { VERCEL: "1", NODE_ENV: "test" },
    { VERCEL: "", NODE_ENV: "development" },
    { NODE_ENV: "production" },
  ]) {
    assert.deepEqual(databaseConfiguration({ ...remote, ...env }), {
      kind: "remote",
      url: remote.DATABASE_URL,
      authToken: remote.DATABASE_AUTH_TOKEN,
    });
  }
  for (const DATABASE_AUTH_TOKEN of [undefined, "", "   "]) {
    assert.throws(
      () =>
        databaseConfiguration({
          ...remote,
          NODE_ENV: "production",
          DATABASE_AUTH_TOKEN,
        }),
      /DATABASE_AUTH_TOKEN/,
    );
  }
  assert.throws(() => databaseConfiguration({ VERCEL: "1" }), /Na Vercel/);
  assert.throws(
    () =>
      databaseConfiguration({
        VERCEL: "1",
        DATABASE_URL: "file:./data/rotina.db",
      }),
    /Na Vercel/,
  );
});

test("configuração remota rejeita URL ambígua ou credenciais na URL sem expor conexão", () => {
  for (const DATABASE_URL of [
    "libsql://",
    "libsql://user:password@host.invalid",
    "libsql://host.invalid/path",
    "libsql://host.invalid?token=hidden",
    "libsql://host.invalid#hidden",
    "libsql://host\n.invalid",
    "https://host.invalid",
  ]) {
    assert.throws(
      () =>
        databaseConfiguration({
          ...remote,
          NODE_ENV: "production",
          DATABASE_URL,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes(DATABASE_URL));
        assert.ok(!error.message.includes(remote.DATABASE_AUTH_TOKEN));
        return true;
      },
    );
  }
});

test("factory recebe URL e authToken remoto, sem conexão de rede e sem alterar variável global", () => {
  const memory = createClient({ url: "file::memory:" });
  let calls = 0;
  try {
    const env = Object.freeze({ ...remote, NODE_ENV: "production" });
    const connection = configuredDatabase(env, process.cwd(), (config) => {
      calls += 1;
      assert.equal(config.url, remote.DATABASE_URL);
      assert.equal(config.authToken, remote.DATABASE_AUTH_TOKEN);
      return memory;
    });
    assert.equal(connection.client, memory);
    assert.equal(calls, 1);
    assert.equal(env.NODE_ENV, "production");
    assert.throws(
      () =>
        configuredDatabase(
          { ...remote, NODE_ENV: "test" },
          process.cwd(),
          () => {
            calls += 1;
            return memory;
          },
        ),
      /apenas SQLite local/,
    );
    assert.equal(calls, 1, "a guarda é avaliada antes de chamar o driver");
    assert.throws(
      () =>
        configuredDatabase(env, process.cwd(), () => {
          throw new Error(
            `${remote.DATABASE_URL} ${remote.DATABASE_AUTH_TOKEN}`,
          );
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes(remote.DATABASE_URL));
        assert.ok(!error.message.includes(remote.DATABASE_AUTH_TOKEN));
        return true;
      },
    );
  } finally {
    memory.close();
  }
});

test("factory local não recebe token remoto residual", () => {
  const memory = createClient({ url: "file::memory:" });
  try {
    configuredDatabase(
      { NODE_ENV: "test", DATABASE_AUTH_TOKEN: remote.DATABASE_AUTH_TOKEN },
      process.cwd(),
      (config) => {
        assert.equal(config.url, "file:./data/rotina.db");
        assert.equal(config.authToken, undefined);
        return memory;
      },
    );
  } finally {
    memory.close();
  }
});

test("migration remota exige produção Vercel ou override explícito; flag não libera runtime dev", () => {
  assert.equal(
    migrationPlan({ ...remote, VERCEL_ENV: "production" }).kind,
    "remote",
  );
  assert.equal(
    migrationPlan({
      ...remote,
      NODE_ENV: "development",
      ALLOW_REMOTE_MIGRATE: "1",
    }).kind,
    "remote",
  );
  assert.throws(
    () =>
      databaseConfiguration({
        ...remote,
        NODE_ENV: "development",
        ALLOW_REMOTE_MIGRATE: "1",
      }),
    /apenas SQLite local/,
  );
  for (const ALLOW_REMOTE_MIGRATE of [undefined, "", "true", "0"]) {
    assert.throws(
      () =>
        migrationPlan({
          ...remote,
          NODE_ENV: "production",
          ALLOW_REMOTE_MIGRATE,
        }),
      /Migration remota bloqueada/,
    );
  }
  assert.throws(
    () =>
      migrationPlan({
        DATABASE_URL: remote.DATABASE_URL,
        VERCEL_ENV: "production",
      }),
    /DATABASE_AUTH_TOKEN/,
  );
  assert.throws(
    () =>
      migrationPlan({
        VERCEL_ENV: "production",
        DATABASE_URL: "file:./data/rotina.db",
      }),
    /Deploy de produção/,
  );
  assert.throws(
    () =>
      migrationPlan({
        NODE_ENV: "production",
        DATABASE_URL: "file:./data/rotina.db",
      }),
    /Migration de producao bloqueada/,
  );
  assert.equal(migrationPlan({ NODE_ENV: "test" }).kind, "local");
});

test("Preview nunca migra, mesmo com override, token ou configuração inválida", () => {
  for (const extra of [
    {},
    { ...remote, ALLOW_REMOTE_MIGRATE: "1", NODE_ENV: "production" },
    { DATABASE_URL: "file:../escape.db" },
  ]) {
    assert.deepEqual(migrationPlan({ ...extra, VERCEL_ENV: "preview" }), {
      kind: "skip",
    });
  }
  for (const VERCEL_ENV of [undefined, "development", "preview"]) {
    assert.deepEqual(
      migrationPlan({
        ...remote,
        ALLOW_REMOTE_MIGRATE: "1",
        npm_lifecycle_event: "vercel-build",
        VERCEL_ENV,
      }),
      { kind: "skip" },
    );
  }
});

test("CLI de Preview encerra antes de abrir banco; CLI remota não autorizada falha sem vazar dados", () => {
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: remote.DATABASE_URL,
    DATABASE_AUTH_TOKEN: remote.DATABASE_AUTH_TOKEN,
    NODE_ENV: "production",
    VERCEL: "1",
    npm_lifecycle_event: "db:migrate",
    ALLOW_REMOTE_MIGRATE: "",
  };
  const preview = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/migrate.ts"],
    {
      encoding: "utf8",
      env: { ...baseEnv, VERCEL_ENV: "preview", ALLOW_REMOTE_MIGRATE: "1" },
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
      env: { ...baseEnv, VERCEL_ENV: "development" },
      timeout: 10_000,
    },
  );
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /Migration remota bloqueada/);
  for (const result of [preview, blocked]) {
    assert.ok(
      !`${result.stdout}${result.stderr}`.includes(remote.DATABASE_URL),
    );
    assert.ok(
      !`${result.stdout}${result.stderr}`.includes(remote.DATABASE_AUTH_TOKEN),
    );
  }
});
