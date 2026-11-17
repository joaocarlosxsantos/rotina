import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activityScheduledOn,
  currentStreak,
  precomputeScheduledDays,
  type ActivitySchedule,
} from "../src/lib/rules";

type Schedule = ActivitySchedule & { routineWeekdays: number };
const days = [
  "2024-02-28",
  "2024-02-29",
  "2024-03-01",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
  "2026-11-23",
  "2026-11-24",
  "2026-11-25",
  "2026-11-26",
  "2026-11-27",
  "2026-11-30",
  "2026-12-01",
  "2026-12-31",
  "2027-01-01",
];
const reference = (schedules: readonly Schedule[], day: string) =>
  schedules.some((schedule) =>
    activityScheduledOn(schedule, schedule.routineWeekdays, day),
  );

test("pré-cálculo equivale à varredura anterior para todas as máscaras, herança e dias da semana", () => {
  for (let routineWeekdays = 1; routineWeekdays <= 127; routineWeekdays++) {
    for (let weekdays = 0; weekdays <= 127; weekdays++) {
      const schedules = [
        { weekdays: weekdays || null, onceDate: null, routineWeekdays },
      ];
      const scheduled = precomputeScheduledDays(schedules);
      for (const day of days) {
        assert.equal(
          scheduled(day),
          reference(schedules, day),
          `${routineWeekdays}/${weekdays}/${day}`,
        );
      }
    }
  }
});

test("união de atividades, datas únicas e sequência mantém o resultado nas viradas de mês/ano", () => {
  const cases: Schedule[][] = [
    [],
    [{ weekdays: null, onceDate: "2026-11-23", routineWeekdays: 127 }],
    [{ weekdays: null, onceDate: null, routineWeekdays: 62 }],
    [
      { weekdays: 2, onceDate: null, routineWeekdays: 127 },
      { weekdays: 16, onceDate: null, routineWeekdays: 127 },
      { weekdays: null, onceDate: "2024-02-29", routineWeekdays: 127 },
      { weekdays: null, onceDate: "2026-12-01", routineWeekdays: 127 },
      { weekdays: null, onceDate: "2026-12-01", routineWeekdays: 1 },
    ],
    [
      { weekdays: null, onceDate: null, routineWeekdays: 62 },
      { weekdays: 65, onceDate: null, routineWeekdays: 2 },
    ],
  ];
  for (const schedules of cases) {
    const scheduled = precomputeScheduledDays(schedules);
    for (const day of days)
      assert.equal(scheduled(day), reference(schedules, day));
    for (const completedDays of [
      [],
      ["2026-11-20"],
      ["2026-11-20", "2026-11-23"],
      ["2026-12-31", "2027-01-01"],
    ]) {
      for (const today of ["2026-11-23", "2026-12-01", "2027-01-03"]) {
        assert.equal(
          currentStreak(completedDays, today, scheduled),
          currentStreak(completedDays, today, (day) =>
            reference(schedules, day),
          ),
        );
      }
    }
  }
});

test("consulta diária não acessa novamente as atividades depois de compiladas", () => {
  let reads = 0;
  const schedule = {
    get weekdays() {
      reads++;
      return 62;
    },
    onceDate: null,
    routineWeekdays: 127,
  };
  const scheduled = precomputeScheduledDays([schedule]);
  assert.ok(reads > 0);
  const compiledReads = reads;
  for (const day of days) scheduled(day);
  assert.equal(reads, compiledReads);
});
