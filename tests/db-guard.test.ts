import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { localDatabaseUrl } from "../src/db/client";

function runMigration(env: Record<string, string>) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/migrate.ts"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, ...env },
    },
  );
}

test("DATABASE_URL aceita apenas arquivo local dentro do diretorio do projeto", async () => {
  const root = await mkdtemp(join(tmpdir(), "rotina-db-guard-"));
  try {
    const inside = resolve(root, "data", "rotina.db");
    assert.equal(localDatabaseUrl(undefined, root), "file:./data/rotina.db");
    assert.equal(localDatabaseUrl("", root), "file:./data/rotina.db");
    assert.equal(
      localDatabaseUrl("file:./data/rotina.db", root),
      "file:./data/rotina.db",
    );
    assert.equal(
      localDatabaseUrl("file:data/rotina.db", root),
      "file:data/rotina.db",
    );
    assert.equal(
      localDatabaseUrl("file:./data/sub/pasta/rotina.db", root),
      "file:./data/sub/pasta/rotina.db",
    );
    assert.equal(localDatabaseUrl(`file:${inside}`, root), `file:${inside}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("DATABASE_URL rejeita fora do projeto, '..', memoria e URLs remotas", async () => {
  const root = await mkdtemp(join(tmpdir(), "rotina-db-guard-"));
  const outside = await mkdtemp(join(tmpdir(), "rotina-db-outside-"));
  try {
    const outsideDb = resolve(outside, "rotina.db");
    const rejected: Array<[string, RegExp]> = [
      ["libsql://invalid.example", /apenas SQLite local/],
      ["file://invalid.example/rotina.db", /rede nao sao permitidos/],
      ["file:", /informe um caminho/],
      ["file::memory:", /memoria nao e permitido/],
      ["file:./data/../rotina.db", /'\.\.' nao e permitido/],
      ["file:../rotina.db", /'\.\.' nao e permitido/],
      ["file:data\\..\\rotina.db", /'\.\.' nao e permitido/],
      [`file:${outsideDb}`, /dentro do projeto/],
      [`file:${root}`, /dentro do projeto/],
      ["file:./data/rotina.db?mode=ro", /query string/],
      ["file://server/share/rotina.db", /rede nao sao permitidos/],
    ];
    for (const [url, expected] of rejected)
      assert.throws(() => localDatabaseUrl(url, root), expected, url);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("script de migration recusa producao e URL fora do projeto sem tocar no banco", async () => {
  const outside = await mkdtemp(join(tmpdir(), "rotina-db-outside-"));
  try {
    const dbPath = join(outside, "rotina.db");
    const production = runMigration({
      NODE_ENV: "production",
      DATABASE_URL: `file:${dbPath}`,
    });
    assert.notEqual(production.status, 0);
    assert.match(production.stderr, /Migration de producao bloqueada/);

    const remote = runMigration({
      NODE_ENV: "test",
      DATABASE_URL: "libsql://invalid.example",
    });
    assert.notEqual(remote.status, 0);
    assert.match(remote.stderr, /apenas SQLite local/);

    const escaped = runMigration({
      NODE_ENV: "test",
      DATABASE_URL: `file:${dbPath}`,
    });
    assert.notEqual(escaped.status, 0);
    assert.match(escaped.stderr, /dentro do projeto/);

    const traversal = runMigration({
      NODE_ENV: "test",
      DATABASE_URL: "file:../rotina-escape.db",
    });
    assert.notEqual(traversal.status, 0);
    assert.match(traversal.stderr, /'\.\.' nao e permitido/);

    await assert.rejects(() => stat(dbPath), { code: "ENOENT" });
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});
