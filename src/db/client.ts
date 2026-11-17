import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export function localDatabaseUrl() {
  const url = process.env.DATABASE_URL ?? "file:./data/rotina.db";
  if (!url.startsWith("file:"))
    throw new Error("Fase 1 permite apenas SQLite local (file:).");
  return url;
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
