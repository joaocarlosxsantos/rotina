import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import * as schema from "./schema";

const DEFAULT_DATABASE_URL = "file:./data/rotina.db";

export type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;
export type DatabaseCredentials = Readonly<{
  url: string;
  authToken?: string;
}>;

function firstConfigured(
  primary: string | undefined,
  fallback: string | undefined,
) {
  return primary?.trim() || fallback?.trim() || "";
}

export function databaseCredentials(
  env: DatabaseEnvironment = process.env,
): DatabaseCredentials {
  const url = firstConfigured(env.DATABASE_URL, env.TURSO_DATABASE_URL);
  const authToken = firstConfigured(
    env.DATABASE_AUTH_TOKEN,
    env.TURSO_AUTH_TOKEN,
  );
  return { url, ...(authToken ? { authToken } : {}) };
}

function isWithin(root: string, target: string) {
  const rel = relative(root, target);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
  );
}

function realpathOfExistingAncestor(target: string) {
  let current = target;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return realpathSync(current);
}

export function localDatabaseUrl(
  url: string | undefined = databaseCredentials().url,
  projectRoot: string = process.cwd(),
) {
  const raw = (url ?? "").trim() || DEFAULT_DATABASE_URL;
  if (!raw.startsWith("file:"))
    throw new Error("Fase 1 permite apenas SQLite local (file:).");

  const filePath = raw.slice("file:".length);
  if (!filePath)
    throw new Error("URL local inválida: informe um caminho apos 'file:'.");
  if (raw.includes("%"))
    throw new Error(
      "URL local inválida: percent-encoding ('%') nao e permitido no caminho.",
    );
  if (filePath === ":memory:" || filePath.startsWith(":memory:"))
    throw new Error(
      "URL local inválida: banco em memoria nao e permitido; use um arquivo dentro do projeto.",
    );

  const drivePath = /^[A-Za-z]:/.test(filePath);
  if (drivePath && !isAbsolute(filePath))
    throw new Error(
      "URL local inválida: caminho relativo a unidade (drive-relative) nao e permitido.",
    );
  if (filePath.indexOf(":", drivePath ? 2 : 0) !== -1)
    throw new Error(
      "URL local inválida: ':' (fluxo alternativo de dados) nao e permitido no caminho.",
    );
  if (/[?#]/.test(filePath))
    throw new Error(
      "URL local inválida: query string e fragmento nao sao suportados.",
    );
  if (/^[\\/]{2}/.test(filePath))
    throw new Error(
      "URL local inválida: caminhos de rede nao sao permitidos; use um arquivo dentro do projeto.",
    );
  if (filePath.split(/[\\/]+/).includes(".."))
    throw new Error("URL local inválida: '..' nao e permitido no caminho.");

  const root = resolve(/* turbopackIgnore: true */ projectRoot);
  const target = isAbsolute(filePath)
    ? resolve(filePath)
    : resolve(root, filePath);
  if (relative(root, target) === "" || !isWithin(root, target))
    throw new Error(
      "URL local inválida: o banco deve ficar dentro do diretorio do projeto.",
    );

  let realRoot: string;
  let realAncestor: string;
  try {
    realRoot = realpathSync(/* turbopackIgnore: true */ root);
    realAncestor = realpathOfExistingAncestor(target);
  } catch {
    throw new Error(
      "URL local inválida: nao foi possivel verificar o caminho do banco.",
    );
  }
  if (!isWithin(realRoot, realAncestor))
    throw new Error(
      "URL local inválida: o banco nao pode apontar (via link) para fora do diretorio do projeto.",
    );
  return raw;
}

export type DatabaseConfiguration =
  | { kind: "local"; url: string; authToken?: never }
  | { kind: "remote"; url: string; authToken: string };

export function databaseConfiguration(
  env: DatabaseEnvironment = process.env,
  projectRoot = process.cwd(),
): DatabaseConfiguration {
  const { url: raw, authToken } = databaseCredentials(env);
  if (raw.startsWith("libsql://")) {
    if (env.VERCEL === undefined && env.NODE_ENV !== "production") {
      throw new Error(
        "Banco remoto permitido apenas na Vercel ou em NODE_ENV=production; desenvolvimento/teste usam apenas SQLite local.",
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(
        "URL remota inválida; use libsql:// com um host válido.",
      );
    }
    if (
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      (parsed.pathname !== "" && parsed.pathname !== "/") ||
      /[\s\u0000-\u001f\u007f]/.test(raw)
    ) {
      throw new Error(
        "URL remota inválida; credenciais, parâmetros e caminhos não são permitidos na URL.",
      );
    }
    if (!authToken)
      throw new Error(
        "DATABASE_AUTH_TOKEN ou TURSO_AUTH_TOKEN é obrigatório para o banco remoto.",
      );
    return { kind: "remote", url: raw, authToken };
  }
  if (env.VERCEL !== undefined)
    throw new Error(
      "Na Vercel, configure DATABASE_URL/DATABASE_AUTH_TOKEN ou TURSO_DATABASE_URL/TURSO_AUTH_TOKEN; não use SQLite em arquivo.",
    );
  return { kind: "local", url: localDatabaseUrl(raw, projectRoot) };
}

export function createDatabase(
  url: string,
  authToken?: string,
  factory: typeof createClient = createClient,
  env: DatabaseEnvironment = process.env,
) {
  // Fixtures locais podem usar memória; nenhum caminho remoto ignora a política.
  const envAuthToken = databaseCredentials(env).authToken;
  const config = url.startsWith("file:")
    ? { url, authToken: undefined }
    : databaseConfiguration({
        ...env,
        DATABASE_URL: url,
        DATABASE_AUTH_TOKEN: authToken ?? envAuthToken,
      });
  const client = factory({
    url: config.url,
    ...(config.authToken ? { authToken: config.authToken } : {}),
  });
  return { client, db: drizzle(client, { schema }) };
}

export function configuredDatabase(
  env: DatabaseEnvironment = process.env,
  projectRoot = process.cwd(),
  factory: typeof createClient = createClient,
) {
  const config = databaseConfiguration(env, projectRoot);
  try {
    return createDatabase(config.url, config.authToken, factory, env);
  } catch (error) {
    if (config.kind === "remote")
      throw new Error(
        "Falha ao configurar o banco remoto; dados de conexão omitidos.",
      );
    throw error;
  }
}

let connection: ReturnType<typeof createDatabase> | undefined;
export function getDatabase() {
  connection ??= configuredDatabase();
  return connection.db;
}
