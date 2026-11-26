import type { petMood } from "../lib/rules";
import { type PetKind, DEFAULT_PET_KIND } from "../lib/pets";
import { getDictionary, getPetCopy, type Locale } from "../lib/i18n";
import { PetHappy, PetOk, PetSad, PetSprite, type Mood } from "./pet-sprites";

type PetMood = ReturnType<typeof petMood>;

function assertNever(value: never): never {
  throw new Error(`Humor do pet inválido: ${String(value)}`);
}

export const MOOD_TO_SPRITE_MOOD: Record<PetMood, Mood> = {
  feliz: "happy",
  ok: "ok",
  triste: "sad",
};

export function Pet({
  mood,
  kind = DEFAULT_PET_KIND,
  locale = "pt",
}: {
  mood: PetMood;
  kind?: PetKind;
  locale?: Locale;
}) {
  if (mood !== "feliz" && mood !== "ok" && mood !== "triste") {
    return assertNever(mood);
  }

  const petName = getPetCopy(kind, locale).name;
  const label = getDictionary(locale).pets.petAriaLabel(petName, mood);
  const className = `pet pet-${mood}`;

  // Para o pet padrão (original), preserva os componentes exatos esperados pelos testes existentes
  if (!kind || kind === "original") {
    switch (mood) {
      case "feliz":
        return <PetHappy className={className} label={label} />;
      case "ok":
        return <PetOk className={className} label={label} />;
      case "triste":
        return <PetSad className={className} label={label} />;
      default:
        return assertNever(mood);
    }
  }

  return (
    <PetSprite
      kind={kind}
      mood={MOOD_TO_SPRITE_MOOD[mood]}
      className={className}
      label={label}
    />
  );
}
