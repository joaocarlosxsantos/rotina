"use client";

import { useEffect, useRef, useState } from "react";
import {
  scheduleSummary,
  toggleWeekday,
  type ActivitySchedule,
  type RepeatMode,
} from "../lib/rules";
import { getDictionary, WEEKDAYS_BY_LOCALE, type Locale } from "../lib/i18n";

export function WeekdayChips({
  mask,
  onChange,
  errorId,
  locale = "pt",
}: {
  mask: number;
  onChange: (mask: number) => void;
  errorId: string;
  locale?: Locale;
}) {
  const t = getDictionary(locale).fields;
  const weekdays = WEEKDAYS_BY_LOCALE[locale];

  return (
    <div
      className="recurrence-days"
      role="group"
      aria-label={t.activityDaysAria}
      aria-invalid={mask === 0}
      aria-describedby={mask === 0 ? errorId : undefined}
    >
      {weekdays.map((day, index) => (
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
  locale = "pt",
}: {
  prefix: string;
  routineWeekdays: number;
  schedule: ActivitySchedule;
  today: string;
  locale?: Locale;
}) {
  const t = getDictionary(locale).fields;
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
      <legend>{t.recurrenceLegend}</legend>
      <div className="recurrence-modes">
        {(
          [
            ["inherit", t.repeatModes.inherit],
            ["weekdays", t.repeatModes.weekdays],
            ["once", t.repeatModes.once],
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
          ? t.inheritHint(
              scheduleSummary(
                { weekdays: null, onceDate: null },
                routineWeekdays,
                locale,
              ),
            )
          : t.spDayHint}
      </p>
      {mode === "weekdays" && (
        <>
          <input type="hidden" name="activityWeekdays" value={mask} />
          <div className="recurrence-presets" aria-label={t.presetsAria}>
            {(
              [
                [127, t.presets.all],
                [62, t.presets.weekdays],
                [65, t.presets.weekend],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setMask(value)}>
                {label}
              </button>
            ))}
          </div>
          <WeekdayChips
            mask={mask}
            onChange={setMask}
            errorId={errorId}
            locale={locale}
          />
          {mask === 0 && (
            <p className="recurrence-error" id={errorId} role="alert">
              {t.chooseOneDayError}
            </p>
          )}
        </>
      )}
      {mode === "once" && (
        <div className="recurrence-date">
          <label htmlFor={`${prefix}-once`}>{t.onceDateLabel}</label>
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
