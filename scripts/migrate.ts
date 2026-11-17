import { mkdir, readdir, readFile, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase, localDatabaseUrl } from "../src/db/client";

const MIGRATIONS_FOLDER = "./drizzle";
const MAX_BACKUPS = 5;

async function hasPendingMigrations(
  client: ReturnType<typeof createDatabase>["client"],
  migrationsFolder: string,
) {
  let applied = 0;
  try {
    const result = await client.execute(
      "select count(*) as count from __drizzle_migrations",
    );
    applied = Number(result.rows[0]?.count ?? 0);
  } catch {
    applied = 0;
  }
  const journal = JSON.parse(
    await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  ) as { entries?: unknown[] };
  return (journal.entries?.length ?? 0) > applied;
}

async function pruneBackups(directory: string, prefix: string) {
  const backups = (await readdir(directory))
    .filter((file) => file.startsWith(prefix) && file.endsWith(".db"))
    .sort()
    .reverse();
  for (const file of backups.slice(MAX_BACKUPS))
    await unlink(join(directory, file));
}

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
  const migrationsFolder = resolve(MIGRATIONS_FOLDER);
  const databasePath = resolve(url.slice("file:".length));
  await mkdir(dirname(databasePath), { recursive: true });
  const { client, db } = createDatabase(url);
  try {
    // O migrator libsql envia tudo por client.migrate(): no driver sqlite3
    // local isso vira BEGIN/COMMIT com ROLLBACK se alguma statement falhar.
    const pending = await hasPendingMigrations(client, migrationsFolder);
    if (pending) {
      // Snapshot consistente, inclusive com WAL; falha no backup impede a migration.
      const backupPath = join(
        dirname(databasePath),
        `${basename(databasePath)}.backup-${Date.now()}-${randomUUID().slice(0, 8)}.db`,
      );
      try {
        await client.execute({ sql: "VACUUM INTO ?", args: [backupPath] });
      } catch (error) {
        throw new Error(
          `Backup do banco falhou; migration cancelada: ${(error as Error).message}`,
        );
      }
      console.log("Backup SQLite local criado antes da migration.");
      try {
        await pruneBackups(
          dirname(databasePath),
          `${basename(databasePath)}.backup-`,
        );
      } catch (error) {
        console.warn(
          `Nao foi possivel remover backups antigos: ${(error as Error).message}`,
        );
      }
    }
    await migrate(db, { migrationsFolder });
    console.log("Migrations aplicadas somente ao SQLite local.");
  } finally {
    client.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
