import { after } from "node:test";
import { sql } from "drizzle-orm";
import { createDatabase, type Database } from "../src/db/client";
import { migrateDatabase } from "../src/db/migrations";

let shared: Awaited<ReturnType<typeof createDatabase>> | undefined;
export async function withDatabase(work: (db: Database) => Promise<void>) {
  if (!shared) {
    shared = await createDatabase();
    await migrateDatabase(shared);
  }
  await shared.db.execute(
    sql`truncate completions, activities, routines restart identity cascade`,
  );
  await work(shared.db);
}
after(async () => {
  if (shared) await shared.close();
});
