import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { authMode, AuthError, credentials, routeRedirect, type CurrentUser } from "../src/auth/contracts";
import { localAdapter, LOCAL_COOKIE_OPTIONS, type SessionCookie } from "../src/auth/local";
import { neonAuthConfig } from "../src/auth/neon";
import { TEST_USER, withDatabase } from "./helpers";

function jar(): SessionCookie {
  let value: string | undefined;
  return { get: () => value, set: (token) => { value = token; }, clear: () => { value = undefined; } };
}
const localEnv = { NODE_ENV: "test" };
test("modo local nunca pode substituir Neon em produção/Vercel", () => {
  for (const env of [{ NODE_ENV: "production" }, { VERCEL: "1", NODE_ENV: "test" }, { VERCEL: "", NODE_ENV: "development" }]) {
    assert.equal(authMode(env), "neon");
    assert.throws(() => localAdapter({} as never, jar(), env), /indisponível/);
  }
  assert.equal(authMode(localEnv), "local");
  assert.equal(LOCAL_COOKIE_OPTIONS.httpOnly, true);
  assert.equal(LOCAL_COOKIE_OPTIONS.sameSite, "lax");
});
test("configuração Neon falha fechada sem segredo ou URL em erro", () => {
  const secret = "fixture-cookie-secret-not-real-0000000000";
  for (const env of [{}, { NEON_AUTH_BASE_URL: "https://auth.example.test", NEON_AUTH_COOKIE_SECRET: "short" }, { NEON_AUTH_BASE_URL: "http://secret:password@auth.example.test", NEON_AUTH_COOKIE_SECRET: secret }]) {
    assert.throws(() => neonAuthConfig(env), (error: unknown) => {
      assert.ok(error instanceof AuthError);
      assert.doesNotMatch(error.message, /password|fixture-cookie|auth\.example/);
      return true;
    });
  }
  assert.equal(neonAuthConfig({ NEON_AUTH_BASE_URL: "https://auth.example.test/auth", NEON_AUTH_COOKIE_SECRET: secret }).logLevel, "silent");
});
test("servidor valida credenciais e não altera senha com trim", () => {
  assert.deepEqual(credentials({ email: " Pessoa@Example.test ", password: " 12345678 " }), { email: "pessoa@example.test", password: " 12345678 " });
  for (const input of [{ email: "bad", password: "12345678" }, { email: "a@b.test", password: "short" }, { email: "a@b.test", password: "a".repeat(129) }, { email: "a@b.test", password: "12345678", name: "x" }]) assert.throws(() => credentials(input, true), AuthError);
});
test("redirecionamentos são fixos: ausência de sessão protege dados; autenticado sai das telas públicas", () => {
  for (const path of ["/", "/rotinas", "/rotinas/qualquer", "//outside.test"]) assert.equal(routeRedirect(path, null), "/entrar");
  for (const path of ["/entrar", "/criar-conta"]) {
    assert.equal(routeRedirect(path, null), null);
    assert.equal(routeRedirect(path, TEST_USER), "/");
  }
});
test("cadastro, login, cookies, rotação, expiração e logout locais sem rede", async () => {
  await withDatabase(async db => {
    const firstJar = jar();
    const adapter = localAdapter(db, firstJar, localEnv);
    assert.equal(await adapter.getCurrentUser(), null);
    const input = { email: "auth-flow@example.test", password: "test-password-123", name: "Pessoa local" };
    await adapter.signUp(input);
    const user = await adapter.getCurrentUser();
    assert.ok(user);
    assert.equal(user.email, input.email);
    const oldToken = firstJar.get()!;
    const replayJar = jar(); replayJar.set(oldToken);
    await adapter.signOut();
    assert.equal(await localAdapter(db, replayJar, localEnv).getCurrentUser(), null);
    assert.equal(await adapter.getCurrentUser(), null);
    await assert.rejects(() => adapter.signIn({ ...input, password: "wrong-password" }), /Confira os dados/);
    await assert.rejects(() => adapter.signIn({ ...input, email: "missing@example.test" }), /Confira os dados/);
    await adapter.signIn(input);
    assert.notEqual(firstJar.get(), oldToken);
    assert.equal((await adapter.getCurrentUser())?.id, user.id);
    await db.execute(sql`update local_auth_sessions set expires_at = now() - interval '1 second'`);
    assert.equal(await adapter.getCurrentUser(), null);
    const stored = await db.execute(sql`select password_hash from local_auth_users where id = ${user.id}`) as {rows: {password_hash: string}[]};
    assert.notEqual(stored.rows[0].password_hash, input.password);
    firstJar.set(user.id);
    assert.equal(await adapter.getCurrentUser(), null);
  });
});
test("duas sessões locais recebem identidades distintas e duplicata de cadastro não autentica", async () => {
  await withDatabase(async db => {
    const a = localAdapter(db, jar(), localEnv), bJar = jar(), b = localAdapter(db, bJar, localEnv);
    await a.signUp({ email: "a-auth@example.test", password: "test-password-123", name: "Pessoa A" });
    await b.signUp({ email: "b-auth@example.test", password: "test-password-123", name: "Pessoa B" });
    assert.notEqual((await a.getCurrentUser())?.id, (await b.getCurrentUser())?.id);
    const empty = localAdapter(db, jar(), localEnv);
    await assert.rejects(() => empty.signUp({ email: "a-auth@example.test", password: "test-password-123", name: "Pessoa X" }), AuthError);
    assert.equal(await empty.getCurrentUser(), null);
  });
});
