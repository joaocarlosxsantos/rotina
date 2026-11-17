import {
  databaseConfiguration,
  type DatabaseConfiguration,
  type DatabaseEnvironment,
} from "./client";

export type MigrationPlan = { kind: "skip" } | DatabaseConfiguration;
export function migrationPlan(
  env: DatabaseEnvironment = process.env,
  projectRoot = process.cwd(),
): MigrationPlan {
  if (
    env.VERCEL_ENV === "preview" ||
    (env.npm_lifecycle_event === "vercel-build" &&
      env.VERCEL_ENV !== "production")
  )
    return { kind: "skip" };
  const remote =
    env.VERCEL !== undefined ||
    env.NODE_ENV === "production" ||
    !!env.DATABASE_URL_UNPOOLED?.trim() ||
    !!(env.DATABASE_URL?.match(/^postgres(ql)?:/) || env.POSTGRES_URL);
  if (remote) {
    const deployedProduction =
      env.VERCEL !== undefined && env.VERCEL_ENV === "production";
    if (!deployedProduction && env.ALLOW_REMOTE_MIGRATE !== "1")
      throw new Error(
        "Migration remota bloqueada; ambiente local exige ALLOW_REMOTE_MIGRATE=1.",
      );
    const url =
      env.DATABASE_URL_UNPOOLED?.trim() ||
      env.DATABASE_URL?.trim() ||
      env.POSTGRES_URL?.trim();
    return databaseConfiguration(
      { ...env, NODE_ENV: "production", DATABASE_URL: url },
      projectRoot,
    );
  }
  return databaseConfiguration(env, projectRoot);
}
