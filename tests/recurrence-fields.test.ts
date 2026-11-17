import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ActivityRecurrence,
  WeekdayChips,
} from "../src/app/activity-recurrence";
import { ActivityFields } from "../src/app/routine-fields";

test("repetição começa herdando a rotina e oferece três rádios nativos rotulados", () => {
  const html = renderToStaticMarkup(
    React.createElement(ActivityFields, {
      prefix: "add",
      routineWeekdays: 62,
      today: "2026-11-17",
    }),
  );
  assert.match(html, /<fieldset[^>]*class="activity-recurrence"/);
  assert.match(html, /<legend>Repetição<\/legend>/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  assert.match(html, /checked=""[^>]*value="inherit"/);
  assert.ok(html.includes("Dias da rotina: Dias úteis."));
  for (const label of ["Segue a rotina", "Dias da semana", "Só uma vez"])
    assert.ok(html.includes(label));
  assert.doesNotMatch(html, /name="activityWeekdays"|name="onceDate"/);
});
test("editar exibe dias persistidos, atalhos e aria-pressed; seleção vazia informa como corrigir", () => {
  const html = renderToStaticMarkup(
    React.createElement(ActivityRecurrence, {
      prefix: "edit",
      routineWeekdays: 127,
      schedule: { weekdays: 42, onceDate: null },
      today: "2026-11-17",
    }),
  );
  assert.match(html, /name="activityWeekdays" value="42"/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 3);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 4);
  for (const day of ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"])
    assert.ok(html.includes(`>${day}</button>`));
  for (const label of ["Todos", "Dias úteis", "Fim de semana"])
    assert.ok(html.includes(`>${label}</button>`));
  assert.equal((html.match(/type="button"/g) ?? []).length, 10);
  const empty = renderToStaticMarkup(
    React.createElement(ActivityRecurrence, {
      prefix: "empty",
      routineWeekdays: 127,
      schedule: { weekdays: 0, onceDate: null },
      today: "2026-11-17",
    }),
  );
  assert.match(empty, /role="alert">Escolha pelo menos um dia da semana/);
  assert.match(
    empty,
    /aria-invalid="true" aria-describedby="empty-repeat-error"/,
  );
});
test("data única persistida é editável com input date obrigatório e não envia bitmask", () => {
  const html = renderToStaticMarkup(
    React.createElement(ActivityRecurrence, {
      prefix: "one",
      routineWeekdays: 1,
      schedule: { weekdays: null, onceDate: "2026-11-20" },
      today: "2026-11-17",
    }),
  );
  const input = html.match(/<input[^>]*type="date"[^>]*>/)?.[0] ?? "";
  assert.match(input, /name="onceDate"/);
  assert.match(input, /required=""/);
  assert.match(html, /value="2026-11-20"/);
  assert.match(html, /for="one-once">Data \(obrigatória\)/);
  assert.doesNotMatch(html, /name="activityWeekdays"/);
});
test("chips de dias não submetem o formulário e usam grupo acessível com estado explícito", () => {
  const html = renderToStaticMarkup(
    React.createElement(WeekdayChips, {
      mask: 65,
      onChange: () => {},
      errorId: "error",
    }),
  );
  assert.match(html, /role="group" aria-label="Dias da atividade"/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.equal((html.match(/type="button"/g) ?? []).length, 7);
});
