import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { localDatabaseUrl } from "../src/db/client";

async function tempDir(prefix: string) {
  return realpath(await mkdtemp(join(tmpdir(), prefix)));
}

function expectReject(url: string, expected: RegExp, root: string) {
  assert.throws(
    () => localDatabaseUrl(url, root),
    (error: unknown) => {
      assert.ok(error instanceof Error, `erro inesperado para ${url}`);
      assert.match(error.message, expected, `mensagem inesperada para ${url}`);
      assert.ok(
        !error.message.includes(root),
        `mensagem vazou caminho absoluto do projeto: ${error.message}`,
      );
      return true;
    },
    url,
  );
}

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
  const root = await tempDir("rotina-db-guard-");
  try {
    const inside = resolve(root, "data", "rotina.db");
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
    if (process.platform === "win32") {
      const otherCase = root.replace(/[A-Za-z]/g, (char) =>
        char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase(),
      );
      const url = `file:${otherCase}\\data\\rotina.db`;
      assert.equal(localDatabaseUrl(url, root), url);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("DATABASE_URL rejeita fora do projeto, '..', memoria, percent, drive-relative, ADS e URLs remotas", async () => {
  const root = await tempDir("rotina-db-guard-");
  const outside = await tempDir("rotina-db-outside-");
  try {
    const outsideDb = resolve(outside, "rotina.db");
    const rejected: Array<[string, RegExp]> = [
      ["libsql://invalid.example", /apenas SQLite local/],
      ["file:", /informe um caminho/],
      ["file::memory:", /memoria nao e permitido/],
      ["file:./data/rotina%2Edb", /percent-encoding/],
      ["file:./data/rotina.db%00", /percent-encoding/],
      ["file:./data/../rotina.db", /'\.\.' nao e permitido/],
      ["file:../rotina.db", /'\.\.' nao e permitido/],
      ["file:data\\..\\rotina.db", /'\.\.' nao e permitido/],
      [`file:${outsideDb}`, /dentro do diretorio do projeto/],
      [`file:${root}`, /dentro do diretorio do projeto/],
      ["file:./data/rotina.db?mode=ro", /query string/],
      ["file:./data/rotina.db#frag", /query string/],
      ["file://server/share/rotina.db", /rede nao sao permitidos/],
      ["file:D:rotina.db", /drive-relative/],
      ["file:C:rotina.db", /drive-relative/],
      ["file:./data/rotina.db:evil", /fluxo alternativo/],
      [`file:${root}\\data\\rotina.db:evil`, /fluxo alternativo/],
    ];
    for (const [url, expected] of rejected) expectReject(url, expected, root);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("DATABASE_URL rejeita junction/symlink que escapa do projeto antes do banco existir", async (t) => {
  const root = await tempDir("rotina-db-guard-");
  const outside = await tempDir("rotina-db-outside-");
  try {
    const link = join(root, "escape");
    try {
      await symlink(outside, link, "junction");
    } catch (error) {
      t.skip(
        `sem permissao para criar junction/symlink: ${(error as Error).message}`,
      );
      return;
    }
    const missing = join(link, "novo", "rotina.db");
    assert.throws(
      () => localDatabaseUrl(`file:${missing}`, root),
      /via link.*fora do diretorio do projeto/,
    );
    await writeFile(join(outside, "rotina.db"), "");
    assert.throws(
      () => localDatabaseUrl(`file:${join(link, "rotina.db")}`, root),
      /via link.*fora do diretorio do projeto/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("script de migration recusa producao e URL fora do projeto sem tocar no banco", async () => {
  const outside = await tempDir("rotina-db-outside-");
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
    assert.match(remote.stderr, /Migration remota bloqueada/);

    const escaped = runMigration({
      NODE_ENV: "test",
      DATABASE_URL: `file:${dbPath}`,
    });
    assert.notEqual(escaped.status, 0);
    assert.match(escaped.stderr, /dentro do diretorio do projeto/);

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
