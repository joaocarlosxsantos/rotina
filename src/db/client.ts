import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import * as schema from "./schema";

const DEFAULT_DATABASE_URL = "file:./data/rotina.db";

function isWithin(root: string, target: string) {
  const rel = relative(root, target);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
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
  url: string | undefined = process.env.DATABASE_URL,
  projectRoot: string = process.cwd(),
) {
  const raw = (url ?? "").trim() || DEFAULT_DATABASE_URL;
  if (!raw.startsWith("file:"))
    throw new Error("Fase 1 permite apenas SQLite local (file:).");

  const filePath = raw.slice("file:".length);
  if (!filePath)
    throw new Error("DATABASE_URL invalida: informe um caminho apos 'file:'.");
  if (raw.includes("%"))
    throw new Error(
      "DATABASE_URL invalida: percent-encoding ('%') nao e permitido no caminho.",
    );
  if (filePath === ":memory:" || filePath.startsWith(":memory:"))
    throw new Error(
      "DATABASE_URL invalida: banco em memoria nao e permitido; use um arquivo dentro do projeto.",
    );

  const drivePath = /^[A-Za-z]:/.test(filePath);
  if (drivePath && !isAbsolute(filePath))
    throw new Error(
      "DATABASE_URL invalida: caminho relativo a unidade (drive-relative) nao e permitido.",
    );
  if (filePath.indexOf(":", drivePath ? 2 : 0) !== -1)
    throw new Error(
      "DATABASE_URL invalida: ':' (fluxo alternativo de dados) nao e permitido no caminho.",
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
  if (relative(root, target) === "" || !isWithin(root, target))
    throw new Error(
      "DATABASE_URL invalida: o banco deve ficar dentro do diretorio do projeto.",
    );

  let realRoot: string;
  let realAncestor: string;
  try {
    realRoot = realpathSync(root);
    realAncestor = realpathOfExistingAncestor(target);
  } catch {
    throw new Error(
      "DATABASE_URL invalida: nao foi possivel verificar o caminho do banco.",
    );
  }
  if (!isWithin(realRoot, realAncestor))
    throw new Error(
      "DATABASE_URL invalida: o banco nao pode apontar (via link) para fora do diretorio do projeto.",
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
