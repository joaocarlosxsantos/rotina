import type { PetKind } from "../lib/pets";

export type PetSpriteProps = {
  size?: number;
  className?: string;
  label?: string;
};

export type Mood = "sad" | "ok" | "happy";

type Pixel = readonly [x: number, y: number];

export interface SpriteDefinition {
  colors: Record<string, string>;
  rows: readonly string[];
  faces: Record<
    Mood,
    {
      eyes: readonly Pixel[];
      mouth: readonly Pixel[];
      cheeks: readonly Pixel[];
    }
  >;
}

export function normalizeSize(size?: number): number {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return 180;
  }
  return Math.max(1, Math.round(size));
}

function PixelRect({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <rect
      x={x}
      y={y}
      width={1}
      height={1}
      fill={fill}
      shapeRendering="crispEdges"
    />
  );
}

// 1. Ursinho (Original)
const ORIGINAL_SPRITE: SpriteDefinition = {
  colors: {
    k: "#203e32", // OUTLINE
    g: "#a9ca7b", // BODY
    l: "#c7e39a", // HIGHLIGHT
    b: "#d58068", // BLUSH
  },
  rows: [
    "................",
    "...kk......kk...",
    "..kggk....kggk..",
    "..kgggkkkkgggk..",
    ".kggggggggggggk.",
    "kgglgggggggglggk",
    "kggggggggggggggk",
    "kggggggggggggggk",
    "kggggggggggggggk",
    "kggggggggggggggk",
    ".kggggggggggggk.",
    ".kggggggggggggk.",
    "..kggggggggggk..",
    "..kggggggggggk..",
    "...kkkk..kkkk...",
    "..kkkk....kkkk..",
  ],
  faces: {
    sad: {
      eyes: [
        [4, 6],
        [5, 7],
        [10, 7],
        [11, 6],
      ],
      mouth: [
        [6, 11],
        [7, 10],
        [8, 10],
        [9, 11],
      ],
      cheeks: [],
    },
    ok: {
      eyes: [
        [4, 7],
        [5, 7],
        [10, 7],
        [11, 7],
      ],
      mouth: [
        [6, 10],
        [7, 10],
        [8, 10],
        [9, 10],
      ],
      cheeks: [],
    },
    happy: {
      eyes: [
        [3, 7],
        [4, 6],
        [5, 7],
        [10, 7],
        [11, 6],
        [12, 7],
      ],
      mouth: [
        [6, 9],
        [7, 10],
        [8, 10],
        [9, 9],
      ],
      cheeks: [
        [2, 9],
        [3, 9],
        [12, 9],
        [13, 9],
      ],
    },
  },
};

// 2. Gatinho
const GATO_SPRITE: SpriteDefinition = {
  colors: {
    k: "#2c1e19",
    g: "#e68c3a",
    l: "#f7b068",
    h: "#fce9d3",
    p: "#e88085",
    b: "#e26f63",
  },
  rows: [
    "................",
    "..kk......kk....",
    ".kppk....kppk...",
    ".kgggk..kgggk...",
    ".kggggkkggggk...",
    "kggggggggggggk..",
    "kgglgggggggglk..",
    "kggggggggggggk..",
    "kgggghhhhggggk..",
    "kggggggggggggkk.",
    ".kgggghhhhggkkkk",
    ".kggggggggggkk..",
    "..kghhhhhhgk....",
    "..kggggggggk....",
    "...kkkk..kk.....",
    "................",
  ],
  faces: {
    sad: {
      eyes: [
        [4, 6],
        [5, 7],
        [10, 7],
        [11, 6],
      ],
      mouth: [
        [7, 10],
        [8, 10],
        [6, 11],
        [9, 11],
      ],
      cheeks: [],
    },
    ok: {
      eyes: [
        [4, 7],
        [5, 7],
        [10, 7],
        [11, 7],
      ],
      mouth: [
        [6, 9],
        [7, 10],
        [8, 10],
        [9, 9],
      ],
      cheeks: [],
    },
    happy: {
      eyes: [
        [3, 7],
        [4, 6],
        [5, 7],
        [10, 7],
        [11, 6],
        [12, 7],
      ],
      mouth: [
        [6, 9],
        [7, 10],
        [8, 10],
        [9, 9],
      ],
      cheeks: [
        [2, 8],
        [3, 8],
        [12, 8],
        [13, 8],
      ],
    },
  },
};

// 3. Cachorrinho
const CACHORRO_SPRITE: SpriteDefinition = {
  colors: {
    k: "#241911",
    g: "#d99b59",
    p: "#804823", // manchinha no olho
    l: "#ebd0a9",
    h: "#fff1db", // focinho creme
    b: "#de766d",
  },
  rows: [
    "................",
    "...kkk..kkk.....",
    "..kppk..kppk....",
    "..kppk..kppk....",
    ".kppggggggppk...",
    ".kpgggggggppk...",
    "kgggglgggglggk..",
    "kggggggppggggk..",
    "kgggghhhhggggk..",
    "kggggggggggggk..",
    ".kggggggggggk...",
    ".kggghhhhgggk...",
    "..kggggggggk....",
    "..kggggggggk....",
    "...kkkk..kk.....",
    "................",
  ],
  faces: {
    sad: {
      eyes: [
        [4, 7],
        [5, 8],
        [10, 8],
        [11, 7],
      ],
      mouth: [
        [7, 11],
        [8, 11],
        [6, 12],
        [9, 12],
      ],
      cheeks: [],
    },
    ok: {
      eyes: [
        [4, 7],
        [5, 7],
        [10, 7],
        [11, 7],
      ],
      mouth: [
        [6, 10],
        [7, 10],
        [8, 10],
        [9, 10],
      ],
      cheeks: [],
    },
    happy: {
      eyes: [
        [3, 7],
        [4, 6],
        [5, 7],
        [10, 7],
        [11, 6],
        [12, 7],
      ],
      mouth: [
        [6, 9],
        [7, 11],
        [8, 11],
        [9, 9],
      ],
      cheeks: [
        [2, 9],
        [3, 9],
        [12, 9],
        [13, 9],
      ],
    },
  },
};

// 4. Coelhinho
const COELHO_SPRITE: SpriteDefinition = {
  colors: {
    k: "#27252a",
    g: "#f5efe6",
    e: "#ef9fb4", // interior das orelhas
    l: "#ffffff",
    h: "#fcf9f4",
    b: "#e8809c",
  },
  rows: [
    "..kk......kk....",
    ".keek....keek...",
    ".keek....keek...",
    ".keek....keek...",
    ".keek....keek...",
    ".kggk....kggk...",
    ".kggggkkggggk...",
    "kggggggggggggk..",
    "kgglgggggggglk..",
    "kggggggggggggk..",
    "kgggghhhhggggk..",
    ".kggggggggggk...",
    ".kggggggggggk...",
    "..kggggggggk....",
    "..kkkk..kkkk....",
    "................",
  ],
  faces: {
    sad: {
      eyes: [
        [4, 8],
        [5, 9],
        [10, 9],
        [11, 8],
      ],
      mouth: [
        [7, 12],
        [8, 12],
        [6, 13],
        [9, 13],
      ],
      cheeks: [],
    },
    ok: {
      eyes: [
        [4, 9],
        [5, 9],
        [10, 9],
        [11, 9],
      ],
      mouth: [
        [6, 11],
        [7, 12],
        [8, 12],
        [9, 11],
      ],
      cheeks: [],
    },
    happy: {
      eyes: [
        [3, 9],
        [4, 8],
        [5, 9],
        [10, 9],
        [11, 8],
        [12, 9],
      ],
      mouth: [
        [6, 11],
        [7, 12],
        [8, 12],
        [9, 11],
      ],
      cheeks: [
        [2, 10],
        [3, 10],
        [12, 10],
        [13, 10],
      ],
    },
  },
};

// 5. Dragãozinho
const DRAGAO_SPRITE: SpriteDefinition = {
  colors: {
    k: "#132f26",
    g: "#3fa789",
    h: "#f3a847", // chifres / barriga dourada
    w: "#6fd2b5", // asinhas
    l: "#92e4cc",
    b: "#de695b",
  },
  rows: [
    "...kk....kk.....",
    "..khhk..khhk....",
    "..khhk..khhk....",
    "..kggggggggk....",
    ".kggggggggggk...",
    "kggggggggggggk..",
    "kgglgggggggglk..",
    "kggggggggggggk..",
    "kwwggggggggwwk..",
    "kwwghhhhhhwwk...",
    ".kghhhhhhhgk....",
    ".kghhhhhhhgk....",
    "..kggggggggk....",
    "..kggggggggk....",
    "...kkk..kkk.....",
    "................",
  ],
  faces: {
    sad: {
      eyes: [
        [4, 6],
        [5, 7],
        [10, 7],
        [11, 6],
      ],
      mouth: [
        [6, 10],
        [7, 9],
        [8, 9],
        [9, 10],
      ],
      cheeks: [],
    },
    ok: {
      eyes: [
        [4, 7],
        [5, 7],
        [10, 7],
        [11, 7],
      ],
      mouth: [
        [6, 9],
        [7, 9],
        [8, 9],
        [9, 9],
      ],
      cheeks: [],
    },
    happy: {
      eyes: [
        [3, 7],
        [4, 6],
        [5, 7],
        [10, 7],
        [11, 6],
        [12, 7],
      ],
      mouth: [
        [6, 8],
        [7, 9],
        [8, 9],
        [9, 8],
      ],
      cheeks: [
        [2, 8],
        [3, 8],
        [12, 8],
        [13, 8],
      ],
    },
  },
};

// 6. Brotinho (Planta / Slime)
const PLANTA_SPRITE: SpriteDefinition = {
  colors: {
    k: "#1b3c1e",
    g: "#68bc56",
    e: "#97dc79", // folha topo
    l: "#c1f0ae",
    f: "#f27163", // flor / bochecha
    b: "#e26155",
  },
  rows: [
    "......kkk.......",
    ".....keekk......",
    "....keeeekk.....",
    ".....kkk.k......",
    "....kggggk......",
    "..kggggggggk....",
    ".kggggggggggk...",
    "kgglgggggggggk..",
    "kgggggggggggggk.",
    "kgggggggggggggk.",
    "kgggggggggggggk.",
    ".kgggggggggggk..",
    ".kgggggggggggk..",
    "..kgggggggggk...",
    "...kkkkkkkkk....",
    "................",
  ],
  faces: {
    sad: {
      eyes: [
        [4, 8],
        [5, 9],
        [9, 9],
        [10, 8],
      ],
      mouth: [
        [6, 12],
        [7, 11],
        [8, 11],
      ],
      cheeks: [],
    },
    ok: {
      eyes: [
        [4, 9],
        [5, 9],
        [9, 9],
        [10, 9],
      ],
      mouth: [
        [6, 11],
        [7, 11],
        [8, 11],
      ],
      cheeks: [],
    },
    happy: {
      eyes: [
        [3, 9],
        [4, 8],
        [5, 9],
        [9, 9],
        [10, 8],
        [11, 9],
      ],
      mouth: [
        [6, 11],
        [7, 12],
        [8, 11],
      ],
      cheeks: [
        [2, 10],
        [3, 10],
        [11, 10],
        [12, 10],
      ],
    },
  },
};

export const SPRITES: Record<PetKind, SpriteDefinition> = {
  original: ORIGINAL_SPRITE,
  gato: GATO_SPRITE,
  cachorro: CACHORRO_SPRITE,
  coelho: COELHO_SPRITE,
  dragao: DRAGAO_SPRITE,
  planta: PLANTA_SPRITE,
};

export function PetSprite({
  kind = "original",
  mood,
  size,
  className,
  label,
}: PetSpriteProps & { kind?: PetKind; mood: Mood }) {
  const pixels = normalizeSize(size);
  const def = SPRITES[kind] ?? SPRITES.original;
  const face = def.faces[mood] ?? def.faces.ok;
  const outlineColor = def.colors.k ?? "#203e32";
  const blushColor = def.colors.b ?? "#d58068";

  return (
    <svg
      className={className}
      width={pixels}
      height={pixels}
      viewBox="0 0 16 16"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      focusable="false"
      shapeRendering="crispEdges"
    >
      {def.rows.flatMap((row, y) =>
        [...row].map((cell, x) => {
          const fill = def.colors[cell];
          return fill ? (
            <PixelRect key={`body-${x}-${y}`} x={x} y={y} fill={fill} />
          ) : null;
        }),
      )}
      {face.eyes.map(([x, y]) => (
        <PixelRect key={`eye-${x}-${y}`} x={x} y={y} fill={outlineColor} />
      ))}
      {face.mouth.map(([x, y]) => (
        <PixelRect key={`mouth-${x}-${y}`} x={x} y={y} fill={outlineColor} />
      ))}
      {face.cheeks.map(([x, y]) => (
        <PixelRect key={`cheek-${x}-${y}`} x={x} y={y} fill={blushColor} />
      ))}
    </svg>
  );
}

export function PetSad({ size, className, label }: PetSpriteProps) {
  return (
    <PetSprite
      kind="original"
      mood="sad"
      size={size}
      className={className}
      label={label}
    />
  );
}

export function PetOk({ size, className, label }: PetSpriteProps) {
  return (
    <PetSprite
      kind="original"
      mood="ok"
      size={size}
      className={className}
      label={label}
    />
  );
}

export function PetHappy({ size, className, label }: PetSpriteProps) {
  return (
    <PetSprite
      kind="original"
      mood="happy"
      size={size}
      className={className}
      label={label}
    />
  );
}
