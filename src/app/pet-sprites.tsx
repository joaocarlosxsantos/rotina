type PetSpriteProps = {
  size?: number;
  className?: string;
  label?: string;
};

type Mood = "sad" | "ok" | "happy";

type Pixel = readonly [x: number, y: number];

const OUTLINE = "#203e32";
const BODY = "#a9ca7b";
const HIGHLIGHT = "#c7e39a";
const BLUSH = "#d58068";

const COLORS: Record<string, string> = {
  k: OUTLINE,
  g: BODY,
  l: HIGHLIGHT,
};

const BODY_ROWS: readonly string[] = [
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
];

const FACES: Record<
  Mood,
  { eyes: readonly Pixel[]; mouth: readonly Pixel[]; cheeks: readonly Pixel[] }
> = {
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
};

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

function Sprite({
  size,
  className,
  label,
  mood,
}: PetSpriteProps & { mood: Mood }) {
  const pixels = normalizeSize(size);
  const face = FACES[mood];

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
      {BODY_ROWS.flatMap((row, y) =>
        [...row].map((cell, x) => {
          const fill = COLORS[cell];
          return fill ? (
            <PixelRect key={`body-${x}-${y}`} x={x} y={y} fill={fill} />
          ) : null;
        }),
      )}
      {face.eyes.map(([x, y]) => (
        <PixelRect key={`eye-${x}-${y}`} x={x} y={y} fill={OUTLINE} />
      ))}
      {face.mouth.map(([x, y]) => (
        <PixelRect key={`mouth-${x}-${y}`} x={x} y={y} fill={OUTLINE} />
      ))}
      {face.cheeks.map(([x, y]) => (
        <PixelRect key={`cheek-${x}-${y}`} x={x} y={y} fill={BLUSH} />
      ))}
    </svg>
  );
}

export function PetSad({ size, className, label }: PetSpriteProps) {
  return <Sprite mood="sad" size={size} className={className} label={label} />;
}

export function PetOk({ size, className, label }: PetSpriteProps) {
  return <Sprite mood="ok" size={size} className={className} label={label} />;
}

export function PetHappy({ size, className, label }: PetSpriteProps) {
  return (
    <Sprite mood="happy" size={size} className={className} label={label} />
  );
}
