export const POINTS_PER_ACTIVITY = 10;
export const TIME_ZONE = "America/Sao_Paulo";

export class InputError extends Error {}

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
  if (done === 0) return "triste";
  return done / total >= 0.7 ? "feliz" : "ok";
}
