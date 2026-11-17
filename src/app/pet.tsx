import type { petMood } from "../lib/rules";
import { PetHappy, PetOk, PetSad } from "./pet-sprites";

type PetMood = ReturnType<typeof petMood>;

function assertNever(value: never): never {
  throw new Error(`Humor do pet inválido: ${String(value)}`);
}

export function Pet({ mood }: { mood: PetMood }) {
  switch (mood) {
    case "feliz":
      return <PetHappy className="pet pet-feliz" label="Pet feliz" />;
    case "ok":
      return <PetOk className="pet pet-ok" label="Pet de boa" />;
    case "triste":
      return <PetSad className="pet pet-triste" label="Pet triste" />;
    default:
      return assertNever(mood);
  }
}
