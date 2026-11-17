import { configuredDatabase } from "../src/db/client";
import { migrationPlan } from "../src/db/migration-policy";
import { migrateDatabase } from "../src/db/migrations";

async function main() {
  const plan = migrationPlan();
  if (plan.kind === "skip") {
    console.log("Migration ignorada: build não é de produção.");
    return;
  }
  const connection =
    plan.kind === "neon"
      ? await configuredDatabase({
          NODE_ENV: "production",
          DATABASE_URL: plan.url,
        })
      : await configuredDatabase({
          NODE_ENV: "test",
          DATABASE_URL:
            plan.dataDir === "memory://"
              ? "memory://"
              : `pglite:${plan.dataDir}`,
        });
  try {
    await migrateDatabase(connection);
    console.log("Migrations Postgres concluídas.");
  } finally {
    await connection.close();
  }
}
main().catch(() => {
  console.error(
    "Migration Postgres recusada ou falhou; verifique configuração, permissão e journal. Credenciais omitidas.",
  );
  process.exitCode = 1;
});
