"use client";

import { useEffect, useRef, useState } from "react";
import {
  WEEKDAYS,
  scheduleSummary,
  toggleWeekday,
  type ActivitySchedule,
  type RepeatMode,
} from "../lib/rules";

export function WeekdayChips({
  mask,
  onChange,
  errorId,
}: {
  mask: number;
  onChange: (mask: number) => void;
  errorId: string;
}) {
  return (
    <div
      className="recurrence-days"
      role="group"
      aria-label="Dias da atividade"
      aria-invalid={mask === 0}
      aria-describedby={mask === 0 ? errorId : undefined}
    >
      {WEEKDAYS.map((day, index) => (
        <button
          key={day}
          type="button"
          aria-pressed={(mask & (1 << index)) !== 0}
          onClick={() => onChange(toggleWeekday(mask, index))}
        >
          {day}
        </button>
      ))}
    </div>
  );
}

export function ActivityRecurrence({
  prefix,
  routineWeekdays,
  schedule,
  today,
}: {
  prefix: string;
  routineWeekdays: number;
  schedule: ActivitySchedule;
  today: string;
}) {
  const [mode, setMode] = useState<RepeatMode>(
    schedule.onceDate
      ? "once"
      : schedule.weekdays !== null
        ? "weekdays"
        : "inherit",
  );
  const [mask, setMask] = useState(schedule.weekdays ?? routineWeekdays);
  const [date, setDate] = useState(schedule.onceDate ?? today);
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const errorId = `${prefix}-repeat-error`;
  useEffect(() => {
    const form = fieldset.current?.form;
    const validate = (event: Event) => {
      if (mode !== "weekdays" || mask !== 0) return;
      event.preventDefault();
      fieldset.current
        ?.querySelector<HTMLButtonElement>(".recurrence-days button")
        ?.focus();
    };
    form?.addEventListener("submit", validate);
    return () => form?.removeEventListener("submit", validate);
  }, [mode, mask]);
  return (
    <fieldset
      ref={fieldset}
      className="activity-recurrence"
      aria-describedby={`${prefix}-repeat-help`}
    >
      <legend>Repetição</legend>
      <div className="recurrence-modes">
        {(
          [
            ["inherit", "Segue a rotina"],
            ["weekdays", "Dias da semana"],
            ["once", "Só uma vez"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} htmlFor={`${prefix}-repeat-${value}`}>
            <input
              id={`${prefix}-repeat-${value}`}
              type="radio"
              name="repeatMode"
              value={value}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {label}
          </label>
        ))}
      </div>
      <p id={`${prefix}-repeat-help`} className="hint">
        {mode === "inherit"
          ? `Dias da rotina: ${scheduleSummary({ weekdays: null, onceDate: null }, routineWeekdays)}.`
          : "A agenda segue o dia de São Paulo."}
      </p>
      {mode === "weekdays" && (
        <>
          <input type="hidden" name="activityWeekdays" value={mask} />
          <div className="recurrence-presets" aria-label="Atalhos de dias">
            {(
              [
                [127, "Todos"],
                [62, "Dias úteis"],
                [65, "Fim de semana"],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setMask(value)}>
                {label}
              </button>
            ))}
          </div>
          <WeekdayChips mask={mask} onChange={setMask} errorId={errorId} />
          {mask === 0 && (
            <p className="recurrence-error" id={errorId} role="alert">
              Escolha pelo menos um dia da semana.
            </p>
          )}
        </>
      )}
      {mode === "once" && (
        <div className="recurrence-date">
          <label htmlFor={`${prefix}-once`}>Data (obrigatória)</label>
          <input
            id={`${prefix}-once`}
            type="date"
            name="onceDate"
            required
            min="0001-01-01"
            max="9999-12-31"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      )}
    </fieldset>
  );
}
