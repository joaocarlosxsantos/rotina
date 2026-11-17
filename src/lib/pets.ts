export const PET_KINDS = [
  "original",
  "gato",
  "cachorro",
  "coelho",
  "dragao",
  "planta",
] as const;

export type PetKind = (typeof PET_KINDS)[number];

export const DEFAULT_PET_KIND: PetKind = "original";

export interface PetDefinition {
  id: PetKind;
  name: string;
  description: string;
}

export const PET_CATALOG: Record<PetKind, PetDefinition> = {
  original: {
    id: "original",
    name: "Ursinho",
    description: "Orelhinhas redondas, abraço de musgo e um coração tranquilo.",
  },
  gato: {
    id: "gato",
    name: "Gatinho",
    description: "Um pequeno caramelo de bigodes, curioso no seu próprio ritmo.",
  },
  cachorro: {
    id: "cachorro",
    name: "Cachorrinho",
    description: "Orelhas de veludo e uma pintinha de café para celebrar suas vitórias.",
  },
  coelho: {
    id: "coelho",
    name: "Coelhinho",
    description: "Um algodão rosado de orelhas compridas e passos delicados.",
  },
  dragao: {
    id: "dragao",
    name: "Dragãozinho",
    description: "Corajoso e determinado, com uma chama ardente de hábitos.",
  },
  planta: {
    id: "planta",
    name: "Brotinho",
    description: "Cultiva seus hábitos dia a dia com paciência e carinho.",
  },
};

export function isPetKind(value: unknown): value is PetKind {
  return typeof value === "string" && (PET_KINDS as readonly string[]).includes(value);
}

export function parsePetKind(value: unknown): PetKind {
  if (isPetKind(value)) return value;
  return DEFAULT_PET_KIND;
}
