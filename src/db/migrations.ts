import type { DatabaseConnection } from "./client";

export async function migrateDatabase(
  connection: DatabaseConnection,
  folder = "./drizzle",
) {
  if (connection.kind === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(connection.db, { migrationsFolder: folder });
  } else {
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    await migrate(connection.db, { migrationsFolder: folder });
  }
}
