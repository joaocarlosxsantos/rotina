import {
  ALL_WEEKDAYS,
  WEEKDAYS,
  dayKey,
  type ActivitySchedule,
} from "../lib/rules";
import { ActivityRecurrence } from "./activity-recurrence";

export function RoutineFields({
  prefix,
  name = "",
  days = ALL_WEEKDAYS,
}: {
  prefix: string;
  name?: string;
  days?: readonly number[];
}) {
  return (
    <>
      <label htmlFor={`${prefix}-name`}>
        Nome da rotina <span>(obrigatório)</span>
      </label>
      <input
        id={`${prefix}-name`}
        name="name"
        required
        minLength={2}
        maxLength={80}
        defaultValue={name}
        placeholder="Ex.: Minha manhã"
      />
      <fieldset className="weekdays" aria-describedby={`${prefix}-days-help`}>
        <legend>
          Dias da semana <span>(obrigatório)</span>
        </legend>
        <p id={`${prefix}-days-help`} className="hint">
          Escolha ao menos um dia. A agenda segue o fuso de São Paulo.
        </p>
        <div className="day-options">
          {WEEKDAYS.map((day, index) => (
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
}: {
  prefix: string;
  name?: string;
  time?: string | null;
  routineWeekdays?: number;
  schedule?: ActivitySchedule;
  today?: string;
}) {
  return (
    <div className="activity-fields">
      <div>
        <label htmlFor={`${prefix}-name`}>
          Nome da atividade <span>(obrigatório)</span>
        </label>
        <input
          id={`${prefix}-name`}
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={name}
          placeholder="Ex.: caminhar por 15 minutos"
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-time`}>
          Horário <span>(opcional)</span>
        </label>
        <input
          id={`${prefix}-time`}
          type="time"
          name="time"
          step={60}
          defaultValue={time ?? ""}
          aria-describedby={`${prefix}-time-help`}
        />
        <small id={`${prefix}-time-help`}>
          Referência em São Paulo; não bloqueia a conclusão.
        </small>
      </div>
      <ActivityRecurrence
        prefix={prefix}
        routineWeekdays={routineWeekdays}
        schedule={schedule}
        today={today}
      />
    </div>
  );
}
