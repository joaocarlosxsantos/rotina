import React from 'react';
import { LogoMark, LogoMarkProps } from './LogoMark';

export type LogoProps = {
  size?: number; // Height of the logo in pixels (default: 36)
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  variant?: 'horizontal' | 'mark-only';
  mood?: LogoMarkProps['mood'];
};

const OUTLINE = '#203e32';
const PRIMARY = '#315e43';
const PALE = '#e8eddf';
const BORDER = '#c5cbbf';

export function Logo({
  size = 36,
  className,
  style,
  title = 'Rotina Pet',
  variant = 'horizontal',
  mood = 'happy',
}: LogoProps) {
  if (variant === 'mark-only') {
    return <LogoMark size={size} className={className} style={style} title={title} mood={mood} />;
  }

  // Aspect ratio for horizontal logo: 160 width x 36 height (~4.44:1)
  const width = Math.round((size / 36) * 160);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 36"
      width={width}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <title>{title}</title>

      {/* Pet Symbol (32x32 at x=2, y=2) */}
      <g transform="translate(2, 2) scale(2)">
        <LogoMark size={16} title="" mood={mood} />
      </g>

      {/* Wordmark: "Rotina" */}
      <text
        x="42"
        y="24"
        fill={OUTLINE}
        fontFamily="var(--font-display, Georgia, serif)"
        fontSize="19"
        fontWeight="600"
        letterSpacing="-0.02em"
      >
        Rotina
      </text>

      {/* Badge container for "Pet" */}
      <rect
        x="104"
        y="8"
        width="46"
        height="20"
        rx="5"
        fill={PALE}
        stroke={BORDER}
        strokeWidth="1"
      />

      {/* Wordmark: "Pet" inside badge */}
      <text
        x="127"
        y="22"
        fill={PRIMARY}
        fontFamily="var(--font-sans, system-ui, sans-serif)"
        fontSize="12"
        fontWeight="700"
        letterSpacing="0.04em"
        textAnchor="middle"
      >
        PET
      </text>
    </svg>
  );
}
