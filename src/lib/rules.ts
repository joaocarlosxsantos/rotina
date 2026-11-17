export const POINTS_PER_ACTIVITY = 10;
export const SKIP_PENALTY = 5;
export const MAX_STREAK_BONUS = 5;
export const TIME_ZONE = "America/Sao_Paulo";
export const WEEKDAYS = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export class InputError extends Error {}

export function validWeekdays(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 7) {
    throw new InputError("Escolha pelo menos um dia da semana, de 0 a 6.");
  }
  const days = value.map((day: unknown) => {
    if (
      (typeof day !== "number" && typeof day !== "string") ||
      String(day).length !== 1 ||
      !/^[0-6]$/.test(String(day))
    ) {
      throw new InputError(
        "Dias da semana devem ser números inteiros de 0 a 6.",
      );
    }
    return Number(day);
  });
  return [...new Set(days)].sort((a, b) => a - b);
}

export function weekdaysMask(value: unknown): number {
  return validWeekdays(value).reduce((mask, day) => mask | (1 << day), 0);
}

export function maskDays(mask: number): number[] {
  return ALL_WEEKDAYS.filter((day) => (mask & (1 << day)) !== 0);
}

export function validTime(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length !== 5 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  ) {
    throw new InputError(
      "Informe um horário HH:MM entre 00:00 e 23:59, ou deixe vazio.",
    );
  }
  return value;
}

export function weekdaySP(date: Date): number {
  return new Date(`${dayKey(date)}T12:00:00Z`).getUTCDay();
}

export function completionMessage(completed: boolean): string {
  return completed
    ? "Conclusão registrada. Cada atividade vale pontos uma vez por dia."
    : "Já concluída hoje";
}

export function skipMessage(skipped: boolean): string {
  return skipped
    ? `Atividade pulada. Desconto de até ${SKIP_PENALTY} pontos aplicado, respeitando o saldo mínimo de zero.`
    : "Já pulada hoje";
}

export function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function currentStreak(
  completedDays: readonly string[],
  today: string,
): number {
  const days = new Set(completedDays);
  let cursor = days.has(today) ? today : previousDay(today);
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = previousDay(cursor);
  }
  return count;
}

export function validName(value: unknown): string {
  if (typeof value !== "string")
    throw new InputError("Informe um nome de 2 a 80 caracteres.");
  const name = value.trim();
  if (
    name.length < 2 ||
    name.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(name)
  ) {
    throw new InputError(
      "Use um nome de 2 a 80 caracteres, sem quebras de linha.",
    );
  }
  return name;
}

export function validId(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new InputError(
      "Seleção inválida. Atualize a página e tente novamente.",
    );
  }
  return value;
}

export function dayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function petMood(
  done: number,
  total: number,
): "feliz" | "ok" | "triste" {
  if (total === 0) return "ok";
  const progress = done / total;
  if (progress >= 0.7) return "feliz";
  return progress >= 0.4 ? "ok" : "triste";
}
