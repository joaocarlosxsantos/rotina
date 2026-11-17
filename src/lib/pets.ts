export const PET_KINDS = [
  "original",
  "gato",
  "cachorro",
  "coelho",
  "dragao",
  "planta",
  "hamster",
  "raposa",
  "panda",
  "pinguim",
  "pintinho",
  "coruja",
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
    description: "Asinhas de lavanda, chifres dourados e coragem nas pequenas conquistas.",
  },
  planta: {
    id: "planta",
    name: "Brotinho",
    description: "Uma roseta de folhas num vasinho de barro, crescendo sem pressa com você.",
  },
  hamster: { id: "hamster", name: "Hamster", description: "Bochechas de pãozinho e patinhas cheias de carinho." },
  raposa: { id: "raposa", name: "Raposinha", description: "Uma cauda fofinha para aquecer suas pequenas conquistas." },
  panda: { id: "panda", name: "Pandinha", description: "Abraços macios e uma pausa gostosa entre as tarefas." },
  pinguim: { id: "pinguim", name: "Pinguinzinho", description: "Passinhos juntinhos para acompanhar o seu dia." },
  pintinho: { id: "pintinho", name: "Pintinho", description: "Um pinguinho de sol torcendo por você." },
  coruja: { id: "coruja", name: "Corujinha", description: "Olhinhos atentos e companhia nas horas tranquilas." },
};

export function isPetKind(value: unknown): value is PetKind {
  return typeof value === "string" && (PET_KINDS as readonly string[]).includes(value);
}

export function parsePetKind(value: unknown): PetKind {
  if (isPetKind(value)) return value;
  return DEFAULT_PET_KIND;
}
