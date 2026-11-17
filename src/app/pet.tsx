export function Pet({ mood }: { mood: "feliz" | "ok" | "triste" }) {
  // Sprite vetorial pixelado original; cada célula segue a grade 16 x 16.
  const rows = [
    "................",
    "...##......##...",
    "..#gg#....#gg#..",
    "..#ggg####ggg#..",
    "..#gggggggggg#..",
    ".#gggggggggggg#.",
    ".#gg#gggg#gggg#.",
    ".#gg#gggg#gggg#.",
    ".#gggggggggggg#.",
    "..#gggggggggg#..",
    "...#gggggggg#...",
    "..#gggggggggg#..",
    "..#gggggggggg#..",
    "...###gg###gg#..",
    ".....####.###...",
    "................",
  ];
  return (
    <svg
      className={`pet pet-${mood}`}
      viewBox="0 0 16 16"
      role="img"
      aria-label={`Pet pixel ${mood}`}
      shapeRendering="crispEdges"
    >
      {rows.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell !== "." ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={cell === "#" ? "#203e32" : "#a9ca7b"}
            />
          ) : null,
        ),
      )}
      <path
        d={
          mood === "feliz"
            ? "M6 9h1v1h2V9h1v2H6z"
            : mood === "triste"
              ? "M6 10h1V9h2v1h1v1H9v-1H7v1H6z"
              : "M6 10h4v1H6z"
        }
        fill="#203e32"
      />
      {mood === "feliz" && <path d="M3 8h2v1H3zM11 8h2v1h-2z" fill="#d58068" />}
    </svg>
  );
}
