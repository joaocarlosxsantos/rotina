import { TEST_USER } from "./helpers";
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { completions } from "../src/db/schema";
import {
  addActivity,
  addRoutine,
  archiveActivity,
  archiveRoutine,
  completeActivity,
  dashboard,
  skipActivity,
} from "../src/lib/store";
import {
  currentStreak,
  InputError,
  previousDay,
  skipMessage,
} from "../src/lib/rules";
import { withDatabase } from "./helpers";
const today = new Date("2026-11-17T14:00:00Z");

test("pular desconta 5 uma vez, nunca cria dívida e exclui conclusão no mesmo dia", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, TEST_USER, "Cuidados diários");
    const acts = await Promise.all(
      ["Ler", "Caminhar", "Alongar", "Meditar", "Beber água"].map((name) =>
        addActivity(db, TEST_USER, routine.id, name),
      ),
    );
    await completeActivity(db, TEST_USER, acts[0].id, today);
    assert.equal(await skipActivity(db, TEST_USER, acts[1].id, today), true);
    assert.equal((await dashboard(db, TEST_USER, today)).points, 5);
    assert.equal(await skipActivity(db, TEST_USER, acts[1].id, today), false);
    assert.equal(skipMessage(false), "Já pulada hoje");
    await assert.rejects(
      () => completeActivity(db, TEST_USER, acts[1].id, today),
      /já pulada hoje/,
    );
    await assert.rejects(
      () => skipActivity(db, TEST_USER, acts[0].id, today),
      /já concluída hoje/,
    );
    await skipActivity(db, TEST_USER, acts[2].id, today);
    assert.equal((await dashboard(db, TEST_USER, today)).points, 0);
    await skipActivity(db, TEST_USER, acts[3].id, today);
    assert.equal((await dashboard(db, TEST_USER, today)).points, 0);
    await completeActivity(db, TEST_USER, acts[4].id, today);
    const state = await dashboard(db, TEST_USER, today);
    assert.equal(state.points, 10, "descontos no piso zero não viram dívida");
    assert.equal(state.done, 2);
    assert.equal(state.total, 5);
    assert.equal(
      state.mood,
      "ok",
      "40% de conclusões; puladas permanecem no denominador",
    );
    assert.equal(state.history.length, 5);
    assert.deepEqual(
      state.history.map((row) => row.balanceAfter),
      [10, 0, 0, 5, 10],
    );
    assert.equal(
      state.history.filter((row) => row.status === "skipped").length,
      3,
    );
    assert.ok(
      state.history
        .filter((row) => row.status === "skipped")
        .every((row) => row.points === -5 && row.bonus === 0),
    );
    assert.equal(
      state.routines[0].activities.find((row) => row.id === acts[1].id)!
        .skipped,
      true,
    );
  });
});

test("Promise.all de concluir e pular tem um único vencedor e uma única linha diária", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, TEST_USER, "Concorrência");
    const activity = await addActivity(db, TEST_USER, routine.id, "Atividade disputada");
    const results = await Promise.all([
      completeActivity(db, TEST_USER, activity.id, today).catch((error) => error),
      skipActivity(db, TEST_USER, activity.id, today).catch((error) => error),
    ]);
    assert.equal(results.filter((result) => result === true).length, 1);
    assert.equal(
      results.filter((result) => result instanceof InputError).length,
      1,
    );
    const rows = await db.select().from(completions);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].eventOrder, 1);
    const state = await dashboard(db, TEST_USER, today);
    assert.equal(state.points, rows[0].status === "completed" ? 10 : 0);
    assert.equal(state.done, rows[0].status === "completed" ? 1 : 0);
    assert.equal(state.history.length, 1);
  });
});

test("Promise.all de pulos repetidos e de várias atividades não repete descontos nem perde saldo", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, TEST_USER, "Pulos concorrentes");
    const earned = await addActivity(db, TEST_USER, routine.id, "Concluída primeiro");
    const acts = await Promise.all(
      ["Pular primeira", "Pular segunda", "Pular terceira"].map((name) =>
        addActivity(db, TEST_USER, routine.id, name),
      ),
    );
    await completeActivity(db, TEST_USER, earned.id, today);
    const result = await Promise.all([
      skipActivity(db, TEST_USER, acts[0].id, today),
      skipActivity(db, TEST_USER, acts[0].id, today),
    ]);
    assert.deepEqual(result.toSorted(), [false, true]);
    await Promise.all(
      acts.slice(1).map((activity) => skipActivity(db, TEST_USER, activity.id, today)),
    );
    const state = await dashboard(db, TEST_USER, today);
    assert.equal(state.points, 0);
    assert.equal(state.history.length, 4);
    assert.deepEqual(
      state.history.map((row) => row.eventOrder),
      [4, 3, 2, 1],
    );
    assert.deepEqual(
      state.history.map((row) => row.balanceAfter),
      [0, 0, 5, 10],
    );
  });
});

test("Promise.all de conclusões aplica bônus por conclusão uma única vez, sem perder créditos", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, TEST_USER, "Créditos concorrentes");
    const first = await addActivity(db, TEST_USER, routine.id, "Primeira");
    const second = await addActivity(db, TEST_USER, routine.id, "Segunda");
    await completeActivity(db, TEST_USER, first.id, new Date("2026-11-16T14:00:00Z"));
    const results = await Promise.all([
      completeActivity(db, TEST_USER, first.id, today),
      completeActivity(db, TEST_USER, second.id, today),
      completeActivity(db, TEST_USER, first.id, today),
      completeActivity(db, TEST_USER, second.id, today),
    ]);
    assert.equal(results.filter(Boolean).length, 2);
    const state = await dashboard(db, TEST_USER, today);
    assert.equal(state.points, 32);
    assert.equal(state.streak, 2);
    assert.equal(state.history.length, 3);
    assert.deepEqual(
      state.history.slice(0, 2).map((row) => row.bonus),
      [1, 1],
    );
    assert.deepEqual(
      state.history.map((row) => row.balanceAfter),
      [32, 21, 10],
    );
    assert.equal(state.mood, "feliz");
  });
});

test("sequência conta dias distintos, bônus cresce até 5 e arquivar preserva histórico", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, TEST_USER, "Sequência longa");
    const first = await addActivity(db, TEST_USER, routine.id, "Uma conclusão por dia");
    const second = await addActivity(
      db, TEST_USER,
      routine.id,
      "Outra conclusão no mesmo dia",
    );
    const bonuses = [];
    for (let index = 0; index < 8; index++) {
      const now = new Date(Date.UTC(2026, 10, 10 + index, 14));
      await completeActivity(db, TEST_USER, first.id, now);
      const state = await dashboard(db, TEST_USER, now);
      bonuses.push(state.history[0].bonus);
      assert.equal(state.streak, index + 1);
    }
    assert.deepEqual(bonuses, [0, 1, 2, 3, 4, 5, 5, 5]);
    assert.equal((await dashboard(db, TEST_USER, today)).points, 105);
    await completeActivity(db, TEST_USER, second.id, today);
    assert.equal(await completeActivity(db, TEST_USER, second.id, today), false);
    const state = await dashboard(db, TEST_USER, today);
    assert.equal(state.streak, 8);
    assert.equal(state.points, 120);
    assert.equal(state.history[0].bonus, 5);
    await archiveRoutine(db, TEST_USER, routine.id);
    const archived = await dashboard(db, TEST_USER, today);
    assert.equal(archived.streak, 8);
    assert.equal(archived.points, 120);
    assert.equal(archived.history.length, 9);
    assert.equal(archived.total, 0);
  });
});

test("pular não apaga sequência, mas um dia sem conclusão quebra o próximo bônus", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, TEST_USER, "Dias consecutivos");
    const first = await addActivity(db, TEST_USER, routine.id, "Primeira");
    const second = await addActivity(db, TEST_USER, routine.id, "Segunda");
    const day1 = new Date("2026-11-14T14:00:00Z");
    const day2 = new Date("2026-11-15T14:00:00Z");
    const day3 = new Date("2026-11-16T14:00:00Z");
    await completeActivity(db, TEST_USER, first.id, day1);
    await skipActivity(db, TEST_USER, first.id, day2);
    assert.equal((await dashboard(db, TEST_USER, day2)).streak, 1);
    await completeActivity(db, TEST_USER, second.id, day2);
    assert.equal((await dashboard(db, TEST_USER, day2)).streak, 2);
    assert.equal((await dashboard(db, TEST_USER, day2)).history[0].bonus, 1);
    await skipActivity(db, TEST_USER, first.id, day3);
    assert.equal((await dashboard(db, TEST_USER, day3)).streak, 2);
    assert.equal((await dashboard(db, TEST_USER, today)).streak, 0);
    await completeActivity(db, TEST_USER, first.id, today);
    const state = await dashboard(db, TEST_USER, today);
    assert.equal(state.streak, 1);
    assert.equal(state.history[0].bonus, 0);
    assert.equal(state.points, 21);
  });
});

test("02:59Z e 03:00Z usam dias SP diferentes para exclusividade e bônus", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, TEST_USER, "Virada de dia");
    const first = await addActivity(db, TEST_USER, routine.id, "Primeira");
    const second = await addActivity(db, TEST_USER, routine.id, "Segunda");
    const before = new Date("2026-11-18T02:59:00Z");
    const after = new Date("2026-11-18T03:00:00Z");
    await completeActivity(db, TEST_USER, first.id, before);
    assert.equal(await completeActivity(db, TEST_USER, first.id, before), false);
    assert.equal(await skipActivity(db, TEST_USER, first.id, after), true);
    await completeActivity(db, TEST_USER, second.id, after);
    const state = await dashboard(db, TEST_USER, after);
    assert.equal(state.points, 16);
    assert.equal(state.streak, 2);
    assert.deepEqual(
      state.history.map((row) => row.day),
      ["2026-11-18", "2026-11-18", "2026-11-17"],
    );
    assert.equal(state.history[0].bonus, 1);
    assert.equal(
      await skipActivity(db, TEST_USER, first.id, new Date("2026-11-19T02:59:00Z")),
      false,
    );
    await completeActivity(db, TEST_USER, first.id, new Date("2026-11-19T03:00:00Z"));
    const next = await dashboard(db, TEST_USER, new Date("2026-11-19T03:00:00Z"));
    assert.equal(next.streak, 3);
    assert.equal(next.history[0].bonus, 2);
    assert.equal(next.points, 28);
  });
});

test("pular valida UUID v4 e rejeita item arquivado ou fora da agenda sem gravar pontos", async () => {
  await withDatabase(async (db) => {
    const routine = await addRoutine(db, TEST_USER, "Somente terça", [2]);
    const first = await addActivity(db, TEST_USER, routine.id, "Primeira");
    const second = await addActivity(db, TEST_USER, routine.id, "Segunda");
    for (const id of [
      null,
      "invalid",
      "12345678-1234-1234-8234-123456789abc",
      `${randomUUID()}\n`,
      randomUUID(),
    ]) {
      await assert.rejects(() => skipActivity(db, TEST_USER, id, today), InputError);
    }
    await assert.rejects(
      () => skipActivity(db, TEST_USER, first.id, new Date("2026-11-18T14:00:00Z")),
      InputError,
    );
    await archiveActivity(db, TEST_USER, first.id);
    await assert.rejects(() => skipActivity(db, TEST_USER, first.id, today), InputError);
    await archiveRoutine(db, TEST_USER, routine.id);
    await assert.rejects(() => skipActivity(db, TEST_USER, second.id, today), InputError);
    assert.equal((await db.select().from(completions)).length, 0);
    assert.equal((await dashboard(db, TEST_USER, today)).points, 0);
  });
});

test("sequência atual ancora hoje ou ontem, considera ano/bissexto e ignora datas futuras", () => {
  assert.equal(currentStreak([], "2026-11-17"), 0);
  assert.equal(currentStreak(["2026-11-18"], "2026-11-17"), 0);
  assert.equal(
    currentStreak(["2026-11-15", "2026-11-16", "2026-11-16"], "2026-11-17"),
    2,
  );
  assert.equal(
    currentStreak(["2026-11-14", "2026-11-16", "2026-11-17"], "2026-11-17"),
    2,
  );
  assert.equal(currentStreak(["2025-12-31", "2026-01-01"], "2026-01-01"), 2);
  assert.equal(previousDay("2024-03-01"), "2024-02-29");
});
