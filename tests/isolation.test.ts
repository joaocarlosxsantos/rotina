import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { AuthError, type CurrentUser } from "../src/auth/contracts";
import { routines, activities, completions } from "../src/db/schema";
import { addRoutine, addActivity, updateRoutine, updateActivity, archiveRoutine, archiveActivity, catalog, dashboard, completeActivity, skipActivity, userLedgerLock } from "../src/lib/store";
import { InputError } from "../src/lib/rules";
import { TEST_USER as A, withDatabase } from "./helpers";
const B = { id: "00000000-0000-4000-8000-000000000002", name: "Outra pessoa", email: "b@example.test" };
const now = new Date("2026-11-17T14:00:00Z");

test("A não lê ou escreve rotina, atividade ou pontos de B; erros não revelam existência", async () => {
  await withDatabase(async db => {
    const r = await addRoutine(db, B, "Rotina privada B");
    const a = await addActivity(db, B, r.id, "Atividade privada B");
    await completeActivity(db, B, a.id, now);
    assert.deepEqual(await catalog(db, A), []);
    const state = await dashboard(db, A, now);
    assert.equal(state.points, 0); assert.equal(state.streak, 0); assert.deepEqual(state.history, []); assert.equal(state.total, 0);
    for (const mutation of [
      () => updateRoutine(db, A, r.id, "Invadida", [0]),
      () => archiveRoutine(db, A, r.id),
      () => addActivity(db, A, r.id, "Intrusa"),
      () => updateActivity(db, A, a.id, "Invadida", "12:00"),
      () => archiveActivity(db, A, a.id),
      () => completeActivity(db, A, a.id, now),
      () => skipActivity(db, A, a.id, now),
    ]) await assert.rejects(mutation, (error: unknown) => { assert.ok(error instanceof InputError); assert.doesNotMatch(error.message, /privada|Outra pessoa|b@example/); return true; });
    assert.equal((await catalog(db, B))[0].name, "Rotina privada B");
    assert.equal((await dashboard(db, B, now)).points, 10);
    const missing = "00000000-0000-4000-8000-000000000099";
    let foreign = "", absent = "";
    try { await archiveRoutine(db, A, r.id); } catch(e) { foreign = (e as Error).message; }
    try { await archiveRoutine(db, A, missing); } catch(e) { absent = (e as Error).message; }
    assert.equal(foreign, absent);
  });
});
test("saldo, sequência, bônus e ordem independentes sob Promise.all entre usuários", async () => {
  await withDatabase(async db => {
    const ra = await addRoutine(db, A, "Minha A"), rb = await addRoutine(db, B, "Minha B");
    const aa = await addActivity(db, A, ra.id, "Minha A"), ab = await addActivity(db, B, rb.id, "Minha B");
    await completeActivity(db, A, aa.id, new Date("2026-11-16T14:00:00Z"));
    await Promise.all([completeActivity(db, A, aa.id, now), completeActivity(db, B, ab.id, now), completeActivity(db, B, ab.id, now)]);
    const sa = await dashboard(db, A, now), sb = await dashboard(db, B, now);
    assert.equal(sa.points, 21); assert.equal(sa.streak, 2); assert.equal(sa.history[0].bonus, 1);
    assert.equal(sb.points, 10); assert.equal(sb.streak, 1); assert.equal(sb.history[0].bonus, 0); assert.equal(sb.history[0].eventOrder, 1);
    await skipActivity(db, B, ab.id, new Date("2026-11-18T14:00:00Z"));
    assert.equal((await dashboard(db, B, now)).points, 5);
    assert.equal((await dashboard(db, A, now)).points, 21);
  });
});
test("toda operação de produto exige identidade autenticada, sem sessão padrão", async () => {
  await withDatabase(async db => {
    const no = null as unknown as CurrentUser;
    const id = "00000000-0000-4000-8000-000000000099";
    for (const operation of [() => addRoutine(db,no,"Falha"), () => addActivity(db,no,id,"Falha"), () => updateRoutine(db,no,id,"Falha",[0]), () => updateActivity(db,no,id,"Falha",null), () => archiveRoutine(db,no,id), () => archiveActivity(db,no,id), () => catalog(db,no), () => dashboard(db,no), () => completeActivity(db,no,id), () => skipActivity(db,no,id)]) await assert.rejects(operation, AuthError);
    assert.deepEqual(await db.select().from(routines), []);
  });
});
test("lock transacional é parametrizado e escopado ao usuário", async () => {
  const dialect = new PgDialect();
  const a = dialect.sqlToQuery(userLedgerLock(A)), b = dialect.sqlToQuery(userLedgerLock(B));
  assert.match(a.sql, /pg_advisory_xact_lock\(hashtextextended\(\$1, 724681\)\)/);
  assert.deepEqual(a.params, [A.id]); assert.deepEqual(b.params, [B.id]);
  await withDatabase(async db => {
    const hashes = await db.execute(sql`select hashtextextended(${A.id}, 724681)::text as a, hashtextextended(${B.id}, 724681)::text as b`) as {rows: {a: string; b:string}[]};
    assert.notEqual(hashes.rows[0].a, hashes.rows[0].b);
  });
});
