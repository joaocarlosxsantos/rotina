import { useId } from "react";
import { PET_CATALOG, parsePetKind, type PetKind } from "../lib/pets";

export type PetSpriteProps = { size?: number; className?: string; label?: string; decorative?: boolean };
export type Mood = "sad" | "ok" | "happy";

export function normalizeSize(size?: number): number {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return 180;
  return Math.max(1, Math.round(size));
}

type Coat = { base: string; light: string; ink: string; accent: string };
/** Paletas da ilustração; geometria orgânica em coordenadas de 200 unidades. */
export const SPRITES: Readonly<Record<PetKind, Coat>> = {
  original: { base: "#b8cf92", light: "#e4edc7", ink: "#53634b", accent: "#f5ebd3" },
  gato: { base: "#e7a477", light: "#ffe0b4", ink: "#805a48", accent: "#fff1dd" },
  cachorro: { base: "#caa078", light: "#f4d8b3", ink: "#775747", accent: "#fff0d8" },
  coelho: { base: "#edcdd3", light: "#fff7f1", ink: "#917079", accent: "#fff9f1" },
  dragao: { base: "#b2a2d9", light: "#e4dcfa", ink: "#76638e", accent: "#f8e5ac" },
  planta: { base: "#88b690", light: "#d2e9b5", ink: "#52785b", accent: "#dba78a" },
  hamster: { base: "#dfb481", light: "#ffe6bc", ink: "#886546", accent: "#fff3dc" },
  raposa: { base: "#dc9268", light: "#ffd0a0", ink: "#84553f", accent: "#fff1df" },
  panda: { base: "#ece9de", light: "#fffdf4", ink: "#5c6562", accent: "#687774" },
  pinguim: { base: "#748e9d", light: "#acc5ce", ink: "#4c6473", accent: "#fff5df" },
  pintinho: { base: "#edc86e", light: "#fff2b3", ink: "#9c7844", accent: "#e9a364" },
  coruja: { base: "#b79c87", light: "#ead8bf", ink: "#796351", accent: "#fff0d8" },
};

function Face({ kind, mood, ink }: { kind: PetKind; mood: Mood; ink: string }) {
  const bird = kind === "pinguim" || kind === "pintinho" || kind === "coruja";
  return <g stroke={ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <g className="pet-eyes">
      {[77, 123].map(x => <g key={x}>
        <ellipse cx={x} cy="93" rx={kind === "coruja" ? 10 : 8} ry={mood === "sad" ? 10 : 12} fill="#35434a" stroke="none" />
        <ellipse cx={x - 2.5} cy="88.5" rx="3.4" ry="4" fill="#fffdf7" stroke="none" />
        <circle cx={x + 3} cy="98" r="1.7" fill="#e1eee9" stroke="none" />
        {mood === "sad" && <path d={`M${x-8} 77 Q${x} 78 ${x+4} 73`} fill="none" />}
        {mood === "happy" && <path d={`M${x-6} 75 Q${x} 71 ${x+6} 75`} fill="none" />}
      </g>)}
    </g>
    <g fill="#e9a0a4" opacity={mood === "happy" ? ".8" : ".55"} stroke="none">
      <ellipse cx="62" cy="111" rx={kind === "hamster" ? 14 : 10} ry="6" />
      <ellipse cx="138" cy="111" rx={kind === "hamster" ? 14 : 10} ry="6" />
    </g>
    {bird ? <path d="M94 105 Q100 101 106 105 L100 113 Z" fill="#e9ad67" /> :
      <path d="M95 105 Q100 102 105 105 Q104 110 100 110 Q96 110 95 105" fill={ink} stroke="none" />}
    {mood === "happy" ? <><path d="M91 116 Q100 121 109 116 Q109 130 100 130 Q91 130 91 116" fill="#795355" /><path d="M95 126 Q100 122 105 126" stroke="#eeb0b0" strokeWidth="3" /></> :
      <path d={mood === "sad" ? "M94 122 Q100 116 106 122" : "M94 117 Q100 123 106 117"} fill="none" />}
    {mood === "sad" && <path d="M137 119 C137 119 132 126 132 129 A5 5 0 0 0 142 129 C142 126 137 119 137 119" fill="#a7d4e0" stroke="#7eaebd" strokeWidth="1" />}
    {(kind === "gato" || kind === "hamster") && <path d="M57 108 L42 104 M57 115 L41 117 M143 108 L158 104 M143 115 L159 117" opacity=".65" />}
  </g>;
}

export function PetSprite({ kind = "original", mood, size, className, label, decorative = false }: PetSpriteProps & { kind?: PetKind; mood: Mood }) {
  const id = useId();
  const safeKind = parsePetKind(kind);
  const coat = SPRITES[safeKind];
  const expression = mood === "sad" || mood === "happy" ? mood : "ok";
  const name = label ?? `${PET_CATALOG[safeKind].name} — ${{ sad: "triste", ok: "de boa", happy: "feliz" }[expression]}`;
  const fur = `url(#${id}-fur)`;
  const bird = ["pinguim", "pintinho", "coruja"].includes(safeKind);
  return <svg className={className} width={normalizeSize(size)} height={normalizeSize(size)} viewBox="0 0 200 200"
    role={decorative ? undefined : "img"} aria-label={decorative ? undefined : name} aria-hidden={decorative ? true : undefined} focusable="false" data-pet-kind={safeKind} data-pet-mood={expression}>
    {!decorative && <title>{name}</title>}
    <defs>
      <linearGradient id={`${id}-fur`} x1="0" y1="0" x2=".7" y2="1" gradientUnits="objectBoundingBox">
        <stop stopColor={coat.light} /><stop offset="1" stopColor={coat.base} />
      </linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor={coat.ink} stopOpacity=".2" /><stop offset="1" stopColor={coat.ink} stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="100" cy="180" rx="66" ry="10" fill={`url(#${id}-shadow)`} />
    <g className="pet-body" stroke={coat.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <g transform={expression === "sad" ? "translate(0 4)" : expression === "happy" ? "translate(0 -2)" : undefined}>
        {/* Caudas e asas ficam atrás do corpo e preservam a silhueta da espécie. */}
        {safeKind === "gato" && <path d="M130 158 C180 173 181 124 164 124 C151 124 161 140 155 146 Q148 154 133 146" fill={fur} />}
        {safeKind === "raposa" && <><path d="M123 161 C165 185 190 156 167 112 Q164 140 139 134 Q123 135 123 161" fill={fur} /><path d="M167 112 Q185 141 174 153 Q166 142 153 140 Q165 130 167 112" fill={coat.accent} stroke="none" /></>}
        {safeKind === "dragao" && <>{[false, true].map(right => <path key={String(right)} transform={right ? "translate(200 0) scale(-1 1)" : undefined} d="M68 130 Q41 98 25 113 Q35 123 30 138 Q43 130 49 148 L68 153" fill="#cbbce9" />)}</>}
        {safeKind === "planta" ? <>
          <path d="M100 65 C72 65 44 47 47 26 C76 22 98 39 100 65 M100 66 C101 32 123 18 146 25 C150 48 126 66 100 66" fill={fur} />
          <path d="M99 75 Q94 49 113 34 M99 66 L65 39" fill="none" />
          <path d="M57 120 L66 166 Q68 178 100 178 Q132 178 134 166 L143 120 Z" fill="#dba78a" />
          <path d="M59 122 Q100 133 141 122" fill="none" stroke="#b78269" />
        </> : <>
          {bird && <g fill="#e9b470"><ellipse cx="83" cy="172" rx="16" ry="6" /><ellipse cx="117" cy="172" rx="16" ry="6" /></g>}
          <ellipse cx="100" cy="143" rx={bird ? 40 : 36} ry="33" fill={fur} />
          <ellipse cx="100" cy="149" rx="24" ry="23" fill={safeKind === "panda" ? coat.light : bird ? "#fff3df" : coat.accent} stroke="none" />
          <g fill={safeKind === "panda" ? coat.accent : fur}>
            <ellipse cx="64" cy="143" rx="12" ry="19" transform="rotate(25 64 143)" />
            <ellipse cx="136" cy="143" rx="12" ry="19" transform="rotate(-25 136 143)" />
            {!bird && <><ellipse cx="77" cy="171" rx="17" ry="9" /><ellipse cx="123" cy="171" rx="17" ry="9" /></>}
          </g>
        </>}
        {/* Orelhas: redondas, pontudas, caídas ou compridas, conforme o animal. */}
        {(["original", "hamster", "panda"] as PetKind[]).includes(safeKind) && <g fill={safeKind === "panda" ? coat.accent : fur}>
          <circle cx="58" cy="49" r={safeKind === "hamster" ? 18 : 20} /><circle cx="142" cy="49" r={safeKind === "hamster" ? 18 : 20} />
          {safeKind !== "panda" && <g fill="#e4b5ad" stroke="none"><circle cx="58" cy="49" r="11" /><circle cx="142" cy="49" r="11" /></g>}
        </g>}
        {(safeKind === "gato" || safeKind === "raposa" || safeKind === "coruja") && <g fill={fur}>
          <path d="M44 77 Q36 46 44 26 Q69 33 79 58" /><path d="M121 58 Q131 33 156 26 Q164 46 156 77" />
          {safeKind !== "coruja" && <g fill="#e7b1ab" stroke="none"><path d="M49 58 L48 37 L66 55 Z" /><path d="M134 55 L152 37 L151 58 Z" /></g>}
        </g>}
        {safeKind === "coelho" && <g fill={fur}><ellipse cx="74" cy="42" rx="14" ry="32" transform="rotate(-12 74 42)" /><ellipse cx="126" cy="42" rx="14" ry="32" transform="rotate(12 126 42)" /><g stroke="#e4b0bd" strokeWidth="10"><path d="M74 54 L69 25" /><path d="M126 54 L131 25" /></g></g>}
        {safeKind === "dragao" && <g fill={coat.accent}><path d="M60 61 Q46 39 59 27 Q62 44 76 51 Z" /><path d="M124 51 Q138 44 141 27 Q154 39 140 61 Z" /></g>}
        {safeKind === "pintinho" && <path d="M91 54 Q77 30 92 32 Q103 32 101 47 Q114 30 119 40 Q121 49 107 55" fill={fur} />}
        <path d={safeKind === "raposa" ? "M42 86 C42 57 66 46 100 48 C134 46 158 57 158 86 Q161 116 100 140 Q39 116 42 86" :
          "M42 88 C40 58 65 48 100 49 C135 48 160 58 158 88 C166 124 143 139 100 139 C57 139 34 124 42 88"} fill={fur} />
        {safeKind === "cachorro" && <><path d="M52 62 C30 47 23 73 30 112 Q36 129 47 114 L60 75" fill="#aa8065" /><path d="M148 62 C170 47 177 73 170 112 Q164 129 153 114 L140 75" fill="#aa8065" /><ellipse cx="124" cy="87" rx="19" ry="23" fill="#b48b6e" stroke="none" /></>}
        {(safeKind === "gato") && <path d="M88 53 L92 67 M100 51 L100 67 M112 53 L108 67" stroke="#b47a55" strokeWidth="4" />}
        {safeKind === "panda" && <g fill={coat.accent} stroke="none"><ellipse cx="77" cy="94" rx="17" ry="22" transform="rotate(23 77 94)" /><ellipse cx="123" cy="94" rx="17" ry="22" transform="rotate(-23 123 94)" /></g>}
        {(safeKind === "pinguim" || safeKind === "coruja") && <path d="M100 75 C72 48 43 77 53 106 Q60 132 100 133 Q140 132 147 106 C157 77 128 48 100 75" fill={coat.accent} stroke="none" />}
        {(safeKind === "original" || safeKind === "cachorro" || safeKind === "hamster") && <ellipse cx="100" cy="114" rx={safeKind === "hamster" ? 33 : 25} ry="18" fill={coat.accent} stroke="none" />}
        {safeKind === "raposa" && <path d="M45 100 Q65 111 81 101 Q100 100 119 101 Q135 111 155 100 Q143 128 100 138 Q57 128 45 100" fill={coat.accent} stroke="none" />}
        {safeKind === "dragao" && <g fill={coat.base} stroke="none"><ellipse cx="63" cy="115" rx="4" ry="3" /><ellipse cx="137" cy="115" rx="4" ry="3" /></g>}
        <Face kind={safeKind} mood={expression} ink={coat.ink} />
      </g>
      {expression === "happy" && <path d="M164 37 C153 28 157 19 164 23 C171 14 181 23 175 31 L164 42 Z" fill="#e7a2aa" stroke="#bd7d8b" strokeWidth="1.3" />}
    </g>
  </svg>;
}
export function PetSad(props: PetSpriteProps) { return <PetSprite {...props} kind="original" mood="sad" />; }
export function PetOk(props: PetSpriteProps) { return <PetSprite {...props} kind="original" mood="ok" />; }
export function PetHappy(props: PetSpriteProps) { return <PetSprite {...props} kind="original" mood="happy" />; }
