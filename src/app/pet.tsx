import type { petMood } from "../lib/rules";
import { type PetKind, DEFAULT_PET_KIND } from "../lib/pets";
import { PetHappy, PetOk, PetSad, PetSprite, type Mood } from "./pet-sprites";

type PetMood = ReturnType<typeof petMood>;

function assertNever(value: never): never {
  throw new Error(`Humor do pet inválido: ${String(value)}`);
}

const MOOD_TO_SPRITE_MOOD: Record<PetMood, Mood> = {
  feliz: "happy",
  ok: "ok",
  triste: "sad",
};

const MOOD_LABELS: Record<PetMood, string> = {
  feliz: "Pet feliz",
  ok: "Pet de boa",
  triste: "Pet triste",
};

export function Pet({
  mood,
  kind = DEFAULT_PET_KIND,
}: {
  mood: PetMood;
  kind?: PetKind;
}) {
  if (mood !== "feliz" && mood !== "ok" && mood !== "triste") {
    return assertNever(mood);
  }

  const label = MOOD_LABELS[mood];
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
