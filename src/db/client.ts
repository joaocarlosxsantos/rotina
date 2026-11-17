import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import * as schema from "./schema";

export type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DatabaseConfiguration =
  { kind: "pglite"; dataDir: string } | { kind: "neon"; url: string };
export type DatabaseConnection =
  | {
      kind: "pglite";
      db: PgliteDatabase<typeof schema>;
      close: () => Promise<void>;
    }
  | {
      kind: "neon";
      db: NeonDatabase<typeof schema>;
      close: () => Promise<void>;
    };

function isWithin(root: string, target: string) {
  const rel = relative(root, target);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

export function localDatabaseDirectory(
  value = "",
  projectRoot = process.cwd(),
): string {
  if (value === "memory://") return value;
  const raw = value || "pglite:./data/pglite";
  if (!raw.startsWith("pglite:"))
    throw new Error("Dev/teste usam somente PGlite local ou memory://.");
  const path = raw.slice(7);
  const drive = /^[A-Za-z]:/.test(path);
  if (
    !path ||
    /[%?#\u0000-\u001f\u007f]/.test(path) ||
    /^[\\/]{2}/.test(path) ||
    path.split(/[\\/]+/).includes("..") ||
    (drive && !isAbsolute(path)) ||
    path.indexOf(":", drive ? 2 : 0) !== -1
  ) {
    throw new Error(
      "Diretório PGlite inválido; use um caminho simples dentro do projeto.",
    );
  }
  const root = resolve(/* turbopackIgnore: true */ projectRoot);
  const target = resolve(root, path);
  if (target === root || !isWithin(root, target))
    throw new Error("Diretório PGlite deve ficar dentro do projeto.");
  let ancestor = target;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  if (
    !isWithin(
      realpathSync(/* turbopackIgnore: true */ root),
      realpathSync(/* turbopackIgnore: true */ ancestor),
    )
  ) {
    throw new Error("Diretório PGlite não pode escapar do projeto por link.");
  }
  return target;
}

export function databaseConfiguration(
  env: DatabaseEnvironment = process.env,
  projectRoot = process.cwd(),
): DatabaseConfiguration {
  const raw = env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim() || "";
  const production = env.VERCEL !== undefined || env.NODE_ENV === "production";
  if (!production)
    return {
      kind: "pglite",
      dataDir: localDatabaseDirectory(raw, projectRoot),
    };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "Produção exige DATABASE_URL ou POSTGRES_URL Postgres do Neon.",
    );
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname.endsWith(".neon.tech") ||
    !url.username ||
    !url.password ||
    url.pathname.length < 2 ||
    url.hash ||
    [...url.searchParams.keys()].some(
      (key) =>
        ![
          "sslmode",
          "channel_binding",
          "connect_timeout",
          "application_name",
        ].includes(key),
    ) ||
    /[\s\u0000-\u001f\u007f]/.test(raw) ||
    url.searchParams.get("sslmode") === "disable"
  ) {
    throw new Error(
      "Configuração Postgres do Neon inválida; dados de conexão omitidos.",
    );
  }
  return { kind: "neon", url: raw };
}

export async function createDatabase(
  value = "memory://",
  projectRoot = process.cwd(),
): Promise<Extract<DatabaseConnection, { kind: "pglite" }>> {
  const dataDir = localDatabaseDirectory(value, projectRoot);
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(dataDir);
  await client.waitReady;
  return {
    kind: "pglite",
    db: drizzle(client, { schema }),
    close: () => client.close(),
  };
}

export async function configuredDatabase(
  env: DatabaseEnvironment = process.env,
  projectRoot = process.cwd(),
  remoteFactory?: (url: string) => Promise<DatabaseConnection>,
): Promise<DatabaseConnection> {
  const config = databaseConfiguration(env, projectRoot);
  if (config.kind === "pglite")
    return createDatabase(
      config.dataDir === "memory://" ? "memory://" : `pglite:${config.dataDir}`,
      projectRoot,
    );
  try {
    if (remoteFactory) return await remoteFactory(config.url);
    if (typeof WebSocket === "undefined")
      throw new Error("Node.js 22+ necessário.");
    neonConfig.webSocketConstructor = WebSocket;
    const pool = new Pool({
      connectionString: config.url,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
    });
    pool.on("error", () =>
      console.error("Conexão Postgres indisponível; credenciais omitidas."),
    );
    return {
      kind: "neon",
      db: neonDrizzle(pool, { schema }),
      close: () => pool.end(),
    };
  } catch {
    throw new Error("Falha ao configurar Postgres; credenciais omitidas.");
  }
}

const shared = globalThis as typeof globalThis & {
  rotinaPostgres?: Promise<DatabaseConnection>;
};
export async function getDatabase(): Promise<Database> {
  shared.rotinaPostgres ??= configuredDatabase();
  return (await shared.rotinaPostgres).db;
}
