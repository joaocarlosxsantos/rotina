import React from 'react';

export type LogoMarkProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  mood?: 'happy' | 'ok' | 'sad';
};

const OUTLINE = '#203e32';
const BODY = '#a9ca7b';
const HIGHLIGHT = '#c7e39a';
const BLUSH = '#d58068';

const BODY_ROWS: readonly string[] = [
  '................',
  '...kk......kk...',
  '..kggk....kggk..',
  '..kgggkkkkgggk..',
  '.kggggggggggggk.',
  'kgglgggggggglggk',
  'kggggggggggggggk',
  'kggggggggggggggk',
  'kggggggggggggggk',
  'kggggggggggggggk',
  '.kggggggggggggk.',
  '.kggggggggggggk.',
  '..kggggggggggk..',
  '..kggggggggggk..',
  '...kkkk..kkkk...',
  '..kkkk....kkkk..',
];

const FACES = {
  happy: {
    eyes: [[3, 7], [4, 6], [5, 7], [10, 7], [11, 6], [12, 7]],
    mouth: [[6, 9], [7, 10], [8, 10], [9, 9]],
    cheeks: [[2, 9], [3, 9], [12, 9], [13, 9]],
  },
  ok: {
    eyes: [[4, 7], [5, 7], [10, 7], [11, 7]],
    mouth: [[6, 10], [7, 10], [8, 10], [9, 10]],
    cheeks: [],
  },
  sad: {
    eyes: [[4, 6], [5, 7], [10, 7], [11, 6]],
    mouth: [[6, 11], [7, 10], [8, 10], [9, 11]],
    cheeks: [],
  },
} as const;

export function LogoMark({
  size = 32,
  className,
  style,
  title = 'Rotina Pet Símbolo',
  mood = 'happy',
}: LogoMarkProps) {
  const face = FACES[mood] ?? FACES.happy;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      style={style}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <title>{title}</title>
      {BODY_ROWS.flatMap((row, y) =>
        [...row].map((cell, x) => {
          let fill: string | null = null;
          if (cell === 'k') fill = OUTLINE;
          else if (cell === 'g') fill = BODY;
          else if (cell === 'l') fill = HIGHLIGHT;
          return fill ? (
            <rect key={`b-${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
          ) : null;
        }),
      )}
      {face.eyes.map(([x, y]) => (
        <rect key={`e-${x}-${y}`} x={x} y={y} width={1} height={1} fill={OUTLINE} />
      ))}
      {face.mouth.map(([x, y]) => (
        <rect key={`m-${x}-${y}`} x={x} y={y} width={1} height={1} fill={OUTLINE} />
      ))}
      {face.cheeks.map(([x, y]) => (
        <rect key={`c-${x}-${y}`} x={x} y={y} width={1} height={1} fill={BLUSH} />
      ))}
    </svg>
  );
}
