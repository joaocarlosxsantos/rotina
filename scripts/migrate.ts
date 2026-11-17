import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase, localDatabaseUrl } from "../src/db/client";

async function main() {
  // NODE_ENV nao protege DATABASE_URL: fora de producao, um caminho valido
  // dentro do projeto continua aceito; a guarda real e a de localizacao.
  if (process.env.NODE_ENV === "production")
    throw new Error("Migration de producao bloqueada nesta fase.");
  let url: string;
  try {
    url = localDatabaseUrl();
  } catch (error) {
    throw new Error(`Migration recusada: ${(error as Error).message}`);
  }
  await mkdir(dirname(resolve(url.slice("file:".length))), { recursive: true });
  const { client, db } = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations aplicadas somente ao SQLite local.");
  } finally {
    client.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
