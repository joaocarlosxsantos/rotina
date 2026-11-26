import {
  ALL_WEEKDAYS,
  dayKey,
  type ActivitySchedule,
} from "../lib/rules";
import { getDictionary, WEEKDAYS_BY_LOCALE, type Locale } from "../lib/i18n";
import { ActivityRecurrence } from "./activity-recurrence";

export function RoutineFields({
  prefix,
  name = "",
  days = ALL_WEEKDAYS,
  locale = "pt",
}: {
  prefix: string;
  name?: string;
  days?: readonly number[];
  locale?: Locale;
}) {
  const t = getDictionary(locale).fields;
  const weekdays = WEEKDAYS_BY_LOCALE[locale];

  return (
    <>
      <label htmlFor={`${prefix}-name`}>
        {t.routineNameLabel} <span>{t.requiredTag}</span>
      </label>
      <input
        id={`${prefix}-name`}
        name="name"
        required
        minLength={2}
        maxLength={80}
        defaultValue={name}
        placeholder={t.routineNamePlaceholder}
      />
      <fieldset className="weekdays" aria-describedby={`${prefix}-days-help`}>
        <legend>
          {t.weekdaysLegend} <span>{t.requiredTag}</span>
        </legend>
        <p id={`${prefix}-days-help`} className="hint">
          {t.weekdaysHint}
        </p>
        <div className="day-options">
          {weekdays.map((day, index) => (
            <label key={day} htmlFor={`${prefix}-day-${index}`}>
              <input
                id={`${prefix}-day-${index}`}
                type="checkbox"
                name="days"
                value={index}
                defaultChecked={days.includes(index)}
              />
              {day}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function ActivityFields({
  prefix,
  name = "",
  time = null,
  routineWeekdays = 127,
  schedule = { weekdays: null, onceDate: null },
  today = dayKey(),
  locale = "pt",
}: {
  prefix: string;
  name?: string;
  time?: string | null;
  routineWeekdays?: number;
  schedule?: ActivitySchedule;
  today?: string;
  locale?: Locale;
}) {
  const t = getDictionary(locale).fields;

  return (
    <div className="activity-fields">
      <div>
        <label htmlFor={`${prefix}-name`}>
          {t.activityNameLabel} <span>{t.requiredTag}</span>
        </label>
        <input
          id={`${prefix}-name`}
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={name}
          placeholder={t.activityNamePlaceholder}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-time`}>
          {t.timeLabel} <span>{t.optionalTag}</span>
        </label>
        <input
          id={`${prefix}-time`}
          type="time"
          name="time"
          step={60}
          defaultValue={time ?? ""}
          aria-describedby={`${prefix}-time-help`}
        />
        <small id={`${prefix}-time-help`}>{t.timeHint}</small>
      </div>
      <ActivityRecurrence
        prefix={prefix}
        routineWeekdays={routineWeekdays}
        schedule={schedule}
        today={today}
        locale={locale}
      />
    </div>
  );
}
