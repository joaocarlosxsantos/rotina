import { mkdir, readdir, readFile, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "../src/db/client";
import { migrationPlan } from "../src/db/migration-policy";

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
  let plan: ReturnType<typeof migrationPlan>;
  try {
    plan = migrationPlan();
  } catch (error) {
    throw new Error(`Migration recusada: ${(error as Error).message}`);
  }
  if (plan.kind === "skip") {
    console.log("Migration ignorada: este build não é de produção.");
    return;
  }
  const migrationsFolder = resolve(MIGRATIONS_FOLDER);
  if (plan.kind === "remote") {
    // libsql:// usa batch transacional remoto do cliente; sem VACUUM/backup local.
    // A tabela de controle é criada fora do batch: ver riscos no README.
    try {
      const { client, db } = createDatabase(
        plan.url,
        plan.authToken,
        undefined,
        { ...process.env, NODE_ENV: "production" },
      );
      try {
        await migrate(db, { migrationsFolder });
        console.log("Migrations remotas concluídas.");
      } finally {
        client.close();
      }
    } catch {
      // Exceções do driver podem conter URL/credenciais. Não registrar causa nem stack.
      throw new Error(
        "Migration remota falhou; verifique conectividade, permissões e estado do journal antes de repetir. Dados de conexão foram omitidos.",
      );
    }
    return;
  }
  const databasePath = resolve(plan.url.slice("file:".length));
  await mkdir(dirname(databasePath), { recursive: true });
  const { client, db } = createDatabase(plan.url);
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
