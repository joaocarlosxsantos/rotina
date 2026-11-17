import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { ACCESS_ERROR, AuthError, authMode, credentials, type AuthAdapter, type CurrentUser } from "./contracts";

export const LOCAL_COOKIE = "rotina_local_session";
export const LOCAL_COOKIE_OPTIONS = { httpOnly: true, secure: false, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 };
export interface SessionCookie {
  get(): string | undefined;
  set(token: string): void;
  clear(): void;
}
const derive = promisify(scrypt);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
async function passwordHash(password: string, salt: string) {
  return (await derive(password, salt, 64) as Buffer).toString("hex");
}
export function localAdapter(db: Database, cookie: SessionCookie, env: Readonly<Record<string, string | undefined>> = process.env): AuthAdapter {
  if (authMode(env) !== "local") throw new AuthError("Adaptador local indisponível neste ambiente.");
  async function ready() {
    // Tabelas exclusivas do adaptador local: nunca criadas pelo migrator de produção.
    await db.execute(sql`create table if not exists local_auth_users(id text primary key, email text not null unique, name text not null, salt text not null, password_hash text not null)`);
    await db.execute(sql`create table if not exists local_auth_sessions(token_hash text primary key, user_id text not null references local_auth_users(id), expires_at timestamptz not null)`);
  }
  async function revoke() {
    const token = cookie.get();
    if (token) await db.execute(sql`delete from local_auth_sessions where token_hash = ${digest(token)}`);
  }
  async function session(id: string) {
    await revoke();
    const token = randomBytes(32).toString("hex");
    await db.execute(sql`insert into local_auth_sessions(token_hash, user_id, expires_at) values(${digest(token)}, ${id}, ${new Date(Date.now() + 86_400_000).toISOString()}::timestamptz)`);
    cookie.set(token);
  }
  return {
    async getCurrentUser() {
      const token = cookie.get();
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
      await ready();
      const result = await db.execute(sql`select u.id, u.email, u.name from local_auth_users u inner join local_auth_sessions s on s.user_id = u.id where s.token_hash = ${digest(token)} and s.expires_at > now()`);
      return (result as {rows: CurrentUser[]}).rows[0] ?? null;
    },
    async signUp(input) {
      const valid = credentials(input, true);
      await ready();
      const salt = randomBytes(16).toString("hex");
      const hash = await passwordHash(valid.password, salt);
      const id = randomUUID();
      const result = await db.execute(sql`insert into local_auth_users(id, email, name, salt, password_hash) values(${id}, ${valid.email}, ${valid.name!}, ${salt}, ${hash}) on conflict(email) do nothing returning id`);
      if (!(result as {rows: unknown[]}).rows.length) throw new AuthError("Não foi possível criar a conta. Confira os dados ou tente entrar se já possui cadastro.");
      await session(id);
    },
    async signIn(input) {
      const valid = credentials(input);
      await ready();
      const result = await db.execute(sql`select id, salt, password_hash from local_auth_users where email = ${valid.email}`);
      const row = (result as {rows: {id: string; salt: string; password_hash: string}[]}).rows[0];
      const candidate = await passwordHash(valid.password, row?.salt ?? "local-dummy-salt");
      const expected = row?.password_hash ?? "0".repeat(128);
      if (!timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex")) || !row) throw new AuthError(ACCESS_ERROR);
      await session(row.id);
    },
    async signOut() { await ready(); await revoke(); cookie.clear(); },
  };
}
