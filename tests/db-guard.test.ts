import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  databaseConfiguration,
  localDatabaseDirectory,
} from "../src/db/client";

test("PGlite aceita memória ou diretório dentro do projeto e recusa formatos anteriores", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "pg-guard-")));
  try {
    assert.equal(localDatabaseDirectory("memory://", root), "memory://");
    assert.equal(
      localDatabaseDirectory("", root),
      join(root, "data", "pglite"),
    );
    assert.equal(
      localDatabaseDirectory("pglite:./data/dev", root),
      join(root, "data", "dev"),
    );
    for (const url of [
      "file:old.db",
      "pglite:",
      "pglite:../escape",
      "pglite:data/../escape",
      "pglite:./data/%2e",
      "pglite:./data/db?x=1",
      "pglite:./data/db#x",
      "pglite://network/db",
      "pglite:D:relative",
      "pglite:./data/db:stream",
      `pglite:${root}`,
    ]) {
      assert.throws(
        () => localDatabaseDirectory(url, root),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.ok(!error.message.includes(url));
          return true;
        },
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PGlite rejeita escape por diretório absoluto ou junction antes de criar dados", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "pg-guard-")));
  const outside = await realpath(await mkdtemp(join(tmpdir(), "pg-outside-")));
  try {
    await mkdir(join(root, "data"));
    assert.throws(
      () => localDatabaseDirectory(`pglite:${join(outside, "db")}`, root),
      /dentro do projeto/,
    );
    await symlink(outside, join(root, "escape"), "junction");
    assert.throws(
      () =>
        localDatabaseDirectory(
          `pglite:${join(root, "escape", "not-created")}`,
          root,
        ),
      /por link/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("produção/Vercel nunca usa memória, diretório ou fallback; dev/teste nunca conecta remoto", () => {
  const remote =
    "postgresql://fixture:secret@fixture.neon.tech/app?sslmode=require";
  for (const NODE_ENV of ["development", "test"]) {
    assert.equal(
      databaseConfiguration({ NODE_ENV, DATABASE_URL: "memory://" }).kind,
      "pglite",
    );
    assert.throws(
      () => databaseConfiguration({ NODE_ENV, DATABASE_URL: remote }),
      /somente PGlite/,
    );
  }
  for (const env of [
    { NODE_ENV: "production" },
    { VERCEL: "1", NODE_ENV: "test" },
    { VERCEL: "" },
  ]) {
    for (const DATABASE_URL of [
      undefined,
      "",
      "memory://",
      "pglite:./data/dev",
    ])
      assert.throws(
        () => databaseConfiguration({ ...env, DATABASE_URL }),
        /Produção exige|inválida/,
      );
  }
});
