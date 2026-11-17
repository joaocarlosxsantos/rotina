import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { activities, completions } from "../src/db/schema";
import {
  addActivity,
  addRoutine,
  archiveActivity,
  catalog,
  completeActivity,
  dashboard,
  skipActivity,
  updateActivity,
  updateRoutine,
} from "../src/lib/store";
import {
  activityScheduledOn,
  activityScheduleFromForm,
  currentStreak,
  dayKey,
  InputError,
  scheduleSummary,
  toggleWeekday,
  validActivitySchedule,
  validDate,
} from "../src/lib/rules";
import { TEST_USER as A, withDatabase } from "./helpers";
const B = {
  id: "recurrence-user-b",
  email: "b@example.test",
  name: "Pessoa B",
};
const inherit = { weekdays: null, onceDate: null };
const weekly = (weekdays: number) => ({ weekdays, onceDate: null });
const once = (onceDate: string) => ({ weekdays: null, onceDate });
const at = (day: string) => new Date(`${day}T14:00:00Z`);

test("agenda efetiva herda, substitui a rotina ou usa só a data; semana, mês e fuso", () => {
  assert.equal(activityScheduledOn(inherit, 62, "2026-11-20"), true);
  assert.equal(activityScheduledOn(inherit, 62, "2026-11-21"), false);
  assert.equal(activityScheduledOn(weekly(65), 62, "2026-11-22"), true);
  assert.equal(activityScheduledOn(weekly(65), 62, "2026-11-23"), false);
  assert.equal(activityScheduledOn(once("2026-12-01"), 1, "2026-12-01"), true);
  assert.equal(
    activityScheduledOn(once("2026-12-01"), 127, "2026-11-30"),
    false,
  );
  assert.equal(
    activityScheduledOn(
      once("2026-12-01"),
      127,
      dayKey(new Date("2026-12-01T02:59:00Z")),
    ),
    false,
  );
  assert.equal(
    activityScheduledOn(
      once("2026-12-01"),
      127,
      dayKey(new Date("2026-12-01T03:00:00Z")),
    ),
    true,
  );
  assert.equal(activityScheduledOn(weekly(1), 127, "2027-01-03"), true);
});

test("servidor rejeita máscara inválida, data impossível, tamanho excessivo e modos conflitantes", () => {
  for (const weekdays of [0, 128, -1, 1.5, Number.NaN, "62", true, undefined])
    assert.throws(
      () => validActivitySchedule({ weekdays, onceDate: null }),
      InputError,
    );
  for (const date of [
    "2026-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-01",
    "0000-01-01",
    "2026-1-01",
    "2026-11-20\n",
    "2026-11-20T00:00Z",
    "x".repeat(10000),
    null,
    123,
  ])
    assert.throws(() => validDate(date), InputError);
  assert.equal(validDate("2000-02-29"), "2000-02-29");
  assert.equal(validDate("9999-12-31"), "9999-12-31");
  assert.throws(
    () => validActivitySchedule({ weekdays: 127, onceDate: "2026-11-20" }),
    InputError,
  );
  assert.deepEqual(validActivitySchedule(), inherit);
});

test("formulário valida modo/valor e resumo de agenda mantém a ordem domingo a sábado", () => {
  const form = new FormData();
  assert.equal(activityScheduleFromForm(form), undefined);
  form.set("repeatMode", "inherit");
  assert.deepEqual(activityScheduleFromForm(form), inherit);
  form.set("repeatMode", "weekdays");
  form.set("activityWeekdays", "0");
  assert.throws(() => activityScheduleFromForm(form), /pelo menos um dia/);
  form.set("activityWeekdays", "62");
  assert.deepEqual(activityScheduleFromForm(form), weekly(62));
  form.set("onceDate", "2026-11-20");
  assert.throws(() => activityScheduleFromForm(form), InputError);
  form.delete("activityWeekdays");
  form.set("repeatMode", "once");
  assert.deepEqual(activityScheduleFromForm(form), once("2026-11-20"));
  form.set("repeatMode", "other");
  assert.throws(() => activityScheduleFromForm(form), InputError);
  assert.equal(scheduleSummary(inherit, 127), "Todo dia");
  assert.equal(scheduleSummary(weekly(62), 1), "Dias úteis");
  assert.equal(scheduleSummary(weekly(65), 1), "Fim de semana");
  assert.equal(scheduleSummary(weekly(42), 1), "Seg, Qua, Sex");
  assert.equal(scheduleSummary(once("2026-11-20"), 1), "Só 20/11");
  assert.equal(toggleWeekday(62, 1), 60);
  assert.equal(toggleWeekday(0, 6), 64);
});

test("Hoje e concluir/pular usam a agenda da atividade mesmo fora dos dias da rotina", async () => {
  await withDatabase(async (db) => {
    const r = await addRoutine(db, A, "Rotina segunda", [1]);
    const inherited = await addActivity(db, A, r.id, "Herda");
    const own = await addActivity(db, A, r.id, "Terça", null, weekly(4));
    const unique = await addActivity(
      db,
      A,
      r.id,
      "Uma vez",
      null,
      once("2026-12-01"),
    );
    const tuesday = await dashboard(db, A, at("2026-12-01"));
    assert.equal(tuesday.routines.length, 1);
    assert.deepEqual(
      tuesday.routines[0].activities.map((a) => a.id),
      [own.id, unique.id],
    );
    await assert.rejects(
      () => completeActivity(db, A, inherited.id, at("2026-12-01")),
      InputError,
    );
    await assert.rejects(
      () => skipActivity(db, A, own.id, at("2026-11-30")),
      InputError,
    );
    await completeActivity(db, A, own.id, at("2026-12-01"));
    await skipActivity(db, A, unique.id, at("2026-12-01"));
    const result = await dashboard(db, A, at("2026-12-01"));
    assert.equal(result.points, 5);
    assert.equal(result.done, 1);
    assert.equal(result.total, 2);
    assert.equal((await dashboard(db, A, at("2026-12-02"))).total, 0);
    await assert.rejects(
      () => completeActivity(db, A, unique.id, at("2026-12-02")),
      InputError,
    );
  });
});

test("uma vez não retorna no dia seguinte ou na mesma data de outro ano; histórico fica", async () => {
  await withDatabase(async (db) => {
    const r = await addRoutine(db, A, "Única", [1]);
    const a = await addActivity(
      db,
      A,
      r.id,
      "Virada do mês",
      null,
      once("2026-12-01"),
    );
    await assert.rejects(
      () => completeActivity(db, A, a.id, new Date("2026-12-01T02:59:00Z")),
      InputError,
    );
    assert.equal(
      await completeActivity(db, A, a.id, new Date("2026-12-01T03:00:00Z")),
      true,
    );
    assert.equal(
      await completeActivity(db, A, a.id, new Date("2026-12-01T03:01:00Z")),
      false,
    );
    for (const day of ["2026-12-02", "2027-12-01"]) {
      const state = await dashboard(db, A, at(day));
      assert.equal(state.total, 0);
      assert.equal(state.history.length, 1);
      assert.equal(state.points, 10);
    }
  });
});

test("sequência ignora fim de semana sem agenda, mas dia agendado perdido quebra", async () => {
  await withDatabase(async (db) => {
    const r = await addRoutine(db, A, "Agenda todos os dias");
    const a = await addActivity(db, A, r.id, "Somente úteis", null, weekly(62));
    await completeActivity(db, A, a.id, at("2026-11-20"));
    assert.equal((await dashboard(db, A, at("2026-11-22"))).streak, 1);
    await completeActivity(db, A, a.id, at("2026-11-23"));
    const monday = await dashboard(db, A, at("2026-11-23"));
    assert.equal(monday.streak, 2);
    assert.equal(monday.history[0].bonus, 1);
    assert.equal(monday.points, 21);
    await completeActivity(db, A, a.id, at("2026-11-25"));
    const wednesday = await dashboard(db, A, at("2026-11-25"));
    assert.equal(wednesday.streak, 1);
    assert.equal(wednesday.history[0].bonus, 0);
  });
});

test("agenda de outros usuários não quebra a sequência e edição não reescreve lançamentos", async () => {
  await withDatabase(async (db) => {
    const r = await addRoutine(db, A, "Pessoal");
    const a = await addActivity(db, A, r.id, "Semanal", null, weekly(62));
    const rb = await addRoutine(db, B, "Rotina B");
    await addActivity(db, B, rb.id, "Todo dia B");
    await completeActivity(db, A, a.id, at("2026-11-20"));
    const before = await db.select().from(completions);
    await updateActivity(db, A, a.id, "Agora única", null, once("2026-11-23"));
    assert.deepEqual(await db.select().from(completions), before);
    await assert.rejects(
      () => updateActivity(db, B, a.id, "Invasão", null, weekly(127)),
      InputError,
    );
    await assert.rejects(
      () => addActivity(db, B, r.id, "Invasão", null, once("2026-11-23")),
      InputError,
    );
    const stored = (await catalog(db, A))[0].activities[0];
    assert.equal(stored.onceDate, "2026-11-23");
    assert.equal(stored.weekdays, null);
    await completeActivity(db, A, a.id, at("2026-11-23"));
    assert.equal(
      (await dashboard(db, A, at("2026-11-23"))).history[0].bonus,
      1,
    );
    assert.equal((await dashboard(db, B, at("2026-11-23"))).points, 0);
    // Chamada antiga de edição não apaga os novos campos; herança explícita pode restaurá-los.
    await updateActivity(db, A, a.id, "Nome antigo cliente", null);
    assert.equal(
      (await db.select().from(activities).where(eq(activities.id, a.id)))[0]
        .onceDate,
      "2026-11-23",
    );
    await updateActivity(db, A, a.id, "Herda de novo", null, inherit);
    await updateRoutine(db, A, r.id, "Mudou rotina", [0]);
    assert.equal((await dashboard(db, A, at("2026-11-23"))).total, 0);
  });
});

test("Promise.all de agendas diferentes mantém bônus atômico, idempotência e piso zero", async () => {
  await withDatabase(async (db) => {
    const r = await addRoutine(db, A, "Paralelo");
    const a = await addActivity(db, A, r.id, "Úteis", null, weekly(62));
    const b = await addActivity(
      db,
      A,
      r.id,
      "Só segunda",
      null,
      once("2026-11-23"),
    );
    await completeActivity(db, A, a.id, at("2026-11-20"));
    await Promise.all([
      completeActivity(db, A, a.id, at("2026-11-23")),
      completeActivity(db, A, b.id, at("2026-11-23")),
      completeActivity(db, A, b.id, at("2026-11-23")),
    ]);
    const state = await dashboard(db, A, at("2026-11-23"));
    assert.equal(state.points, 32);
    assert.equal(state.history.filter((e) => e.bonus === 1).length, 2);
    await archiveActivity(db, A, b.id);
    await assert.rejects(
      () => skipActivity(db, A, b.id, at("2026-11-23")),
      InputError,
    );
  });
});

test("sequência atravessa mês/ano e não entra em laço quando não há agenda recorrente", () => {
  const scheduled = (day: string) => activityScheduledOn(weekly(62), 127, day);
  assert.equal(
    currentStreak(["2026-01-30", "2026-02-02"], "2026-02-02", scheduled),
    2,
  );
  assert.equal(
    currentStreak(["2026-12-31", "2027-01-01"], "2027-01-03", scheduled),
    2,
  );
  assert.equal(
    currentStreak(["2026-11-17"], "2026-11-23", () => false),
    1,
  );
});
