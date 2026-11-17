import { PetHappy, PetOk, PetSad } from "./pet-sprites";

export function Pet({ mood }: { mood: "feliz" | "ok" | "triste" }) {
  if (mood === "feliz") {
    return <PetHappy className="pet pet-feliz" label="Pet feliz" />;
  }

  if (mood === "triste") {
    return <PetSad className="pet pet-triste" label="Pet triste" />;
  }

  return <PetOk className="pet pet-ok" label="Pet ok" />;
}
