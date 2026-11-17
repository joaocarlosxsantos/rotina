import {
  databaseConfiguration,
  databaseCredentials,
  localDatabaseUrl,
  type DatabaseEnvironment,
} from "./client";

export type MigrationPlan =
  | { kind: "skip" }
  | { kind: "local"; url: string }
  | { kind: "remote"; url: string; authToken: string };

export function migrationPlan(
  env: DatabaseEnvironment = process.env,
): MigrationPlan {
  // Preview nunca migra, mesmo com override ou credenciais disponíveis.
  if (
    env.VERCEL_ENV === "preview" ||
    (env.npm_lifecycle_event === "vercel-build" &&
      env.VERCEL_ENV !== "production")
  )
    return { kind: "skip" };
  const { url } = databaseCredentials(env);
  if (url.startsWith("libsql://")) {
    if (env.VERCEL_ENV !== "production" && env.ALLOW_REMOTE_MIGRATE !== "1") {
      throw new Error(
        "Migration remota bloqueada: exige VERCEL_ENV=production ou ALLOW_REMOTE_MIGRATE=1; Preview nunca migra.",
      );
    }
    // A autorização explícita vale só para o migrator; não altera o ambiente do app.
    const config = databaseConfiguration({ ...env, NODE_ENV: "production" });
    if (config.kind !== "remote")
      throw new Error("Migration remota exige configuração libsql válida.");
    return config;
  }
  if (env.VERCEL_ENV === "production")
    throw new Error(
      "Deploy de produção exige URL libsql e token (DATABASE_* ou TURSO_*).",
    );
  if (env.NODE_ENV === "production")
    throw new Error("Migration de producao bloqueada para SQLite local.");
  return { kind: "local", url: localDatabaseUrl(url) };
}
