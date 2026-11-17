import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "../src/db/client";
import {
  addActivity,
  addRoutine,
  completeActivity,
  dashboard,
} from "../src/lib/store";
import {
  completionMessage,
  dayKey,
  InputError,
  petMood,
  POINTS_PER_ACTIVITY,
  validId,
  validName,
} from "../src/lib/rules";

test("rotina persiste, pontua uma vez por dia e renova atividades sem perder pontos", async () => {
  const folder = await mkdtemp(join(tmpdir(), "rotina-test-"));
  const url = `file:${join(folder, "test.db").replaceAll("\\", "/")}`;
  let connection = createDatabase(url);
  try {
    await migrate(connection.db, { migrationsFolder: "./drizzle" });
    const routine = await addRoutine(connection.db, "  Minha manhã  ");
    const activity = await addActivity(connection.db, routine.id, "Caminhar");
    const today = new Date("2026-11-17T14:00:00Z");
    assert.equal((await dashboard(connection.db, today)).mood, "triste");
    const results = await Promise.all([
      completeActivity(connection.db, activity.id, today),
      completeActivity(connection.db, activity.id, today),
    ]);
    assert.deepEqual(results.toSorted(), [false, true]);
    assert.equal(
      completionMessage(results.find((completed) => !completed)!),
      "Já concluída hoje",
    );
    const replay = await completeActivity(connection.db, activity.id, today);
    assert.equal(replay, false);
    assert.equal(completionMessage(replay), "Já concluída hoje");
    assert.doesNotMatch(completionMessage(replay), /Conclusão registrada/);
    assert.match(completionMessage(true), /^Conclusão registrada/);
    const state = await dashboard(connection.db, today);
    assert.equal(state.points, POINTS_PER_ACTIVITY);
    assert.equal(state.done, 1);
    assert.equal(state.mood, "feliz");
    assert.equal(state.routines[0].name, "Minha manhã");
    connection.client.close();
    connection = createDatabase(url);
    assert.equal((await dashboard(connection.db, today)).points, 10);
    const tomorrow = new Date("2026-11-18T14:00:00Z");
    const next = await dashboard(connection.db, tomorrow);
    assert.equal(next.done, 0);
    assert.equal(next.points, 10);
    assert.equal(next.mood, "triste");
    await completeActivity(connection.db, activity.id, tomorrow);
    assert.equal((await dashboard(connection.db, tomorrow)).points, 21);
    await assert.rejects(
      () => addActivity(connection.db, "invalid", "Teste"),
      InputError,
    );
    await assert.rejects(
      () =>
        addActivity(
          connection.db,
          "12345678-1234-4234-8234-123456789abc",
          "Teste",
        ),
      InputError,
    );
    await assert.rejects(
      () =>
        completeActivity(
          connection.db,
          "12345678-1234-4234-8234-123456789abc",
          today,
        ),
      InputError,
    );
  } finally {
    connection.client.close();
    await rm(folder, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
});

test("validação de entrada e regras de humor e fuso horário", () => {
  for (const value of [null, "", " ", "a", "x".repeat(81), "Nome\nnovo"])
    assert.throws(() => validName(value), InputError);
  assert.equal(validName("  Ler 10 páginas  "), "Ler 10 páginas");
  assert.equal(dayKey(new Date("2026-11-18T02:59:59Z")), "2026-11-17");
  assert.equal(dayKey(new Date("2026-11-18T03:00:00Z")), "2026-11-18");
});

test("UUIDs de outras versões e variantes inválidas são rejeitados", () => {
  for (const value of [
    "12345678-1234-1234-8234-123456789abc",
    "12345678-1234-5234-8234-123456789abc",
    "12345678-1234-7234-8234-123456789abc",
    "12345678-1234-4234-7234-123456789abc",
    "12345678-1234-4234-c234-123456789abc",
    "invalid",
    null,
  ])
    assert.throws(() => validId(value), InputError);
  const uuid = "12345678-1234-4234-8234-123456789abc";
  assert.equal(validId(uuid), uuid);
  assert.equal(validId(uuid.toUpperCase()), uuid.toUpperCase());
});

test("pet: triste abaixo de 40%, ok a partir de 40% e feliz a partir de 70%", () => {
  for (const [done, total, expected] of [
    [0, 0, "ok"],
    [0, 3, "triste"],
    [1, 3, "triste"],
    [39, 100, "triste"],
    [40, 100, "ok"],
    [2, 3, "ok"],
    [69, 100, "ok"],
    [70, 100, "feliz"],
    [7, 10, "feliz"],
    [3, 3, "feliz"],
  ] as const)
    assert.equal(petMood(done, total), expected, `${done}/${total}`);
});
