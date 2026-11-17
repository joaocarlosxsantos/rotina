import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { isAbsolute, relative, resolve, sep } from "node:path";
import * as schema from "./schema";

const DEFAULT_DATABASE_URL = "file:./data/rotina.db";

export function localDatabaseUrl(
  url: string | undefined = process.env.DATABASE_URL,
  projectRoot: string = process.cwd(),
) {
  const raw = (url ?? "").trim() || DEFAULT_DATABASE_URL;
  if (!raw.startsWith("file:"))
    throw new Error("Fase 1 permite apenas SQLite local (file:).");

  const filePath = raw.slice("file:".length);
  if (!filePath)
    throw new Error("DATABASE_URL invalida: informe um caminho apos 'file:'.");
  if (filePath === ":memory:" || filePath.startsWith(":memory:"))
    throw new Error(
      "DATABASE_URL invalida: banco em memoria nao e permitido; use um arquivo dentro do projeto.",
    );
  if (/[?#]/.test(filePath))
    throw new Error(
      "DATABASE_URL invalida: query string e fragmento nao sao suportados.",
    );
  if (/^[\\/]{2}/.test(filePath))
    throw new Error(
      "DATABASE_URL invalida: caminhos de rede nao sao permitidos; use um arquivo dentro do projeto.",
    );
  if (filePath.split(/[\\/]+/).includes(".."))
    throw new Error("DATABASE_URL invalida: '..' nao e permitido no caminho.");

  const root = resolve(projectRoot);
  const target = isAbsolute(filePath) ? resolve(filePath) : resolve(root, filePath);
  const rel = relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error(
      `DATABASE_URL invalida: o banco deve ficar dentro do projeto (${root}).`,
    );
  return raw;
}

export function createDatabase(url: string) {
  const client = createClient({ url });
  return { client, db: drizzle(client, { schema }) };
}

let connection: ReturnType<typeof createDatabase> | undefined;
export function getDatabase() {
  connection ??= createDatabase(localDatabaseUrl());
  return connection.db;
}
