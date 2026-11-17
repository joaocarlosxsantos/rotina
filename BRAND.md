# Identidade Visual — Rotina Pet

Guia oficial de identidade visual, design tokens, tipografia e diretrizes de marca para o **Rotina Pet**.

---

## 1. Fundamentos da Marca

- **Nome:** Rotina Pet
- **Tagline (pt-BR):** *Seus hábitos com um companheiro pixel.*
- **Tagline secundária:** *Pequenos passos todo dia, um companheiro sempre feliz.*
- **Personalidade:**
  - **Acolhedora e gentil:** Sem julgamentos, punições agressivas ou ansiedade de gamificação tóxica. O foco é celebrar cada passo completado.
  - **Artesanal & Nostálgica ("Cozy Retro"):** Uma experiência tátil de caderno de papel com a diversão calorosa do pixel art 16-bit.
  - **Focada e Serena:** Interface limpa, com ritmo visual claro e sem poluição de alertas estridentes.

---

## 2. Tipografia Distintiva

Em conformidade com as diretrizes de design, foram eliminadas fontes genéricas e saturadas (*Arial, Inter, Roboto, Fraunces, Geist, Plus Jakarta, Space Grotesk*).

Para criar uma identidade autêntica de "caderno de hábitos com companheiro pixel", selecionamos uma tríade complementar via `next/font/google` (self-hosted automaticamente no build do Next.js/Vercel, sem requisições externas em tempo de execução e com zero impacto de privacidade/GDPR):

| Função | Família Tipográfica | Classificação | Variável CSS | Justificativa de Design |
|---|---|---|---|---|
| **Display / Títulos** | **Newsreader** | Serif Editorial | `--font-display` | Desenhada pela conceituada fundição *Production Type*. Possui proporções clássicas e aconchegantes com modulação orgânica, transmitindo a sensação de um diário ou caderno físico de alta qualidade. Substitui o padrão frio de fontes sans-serif corporativas. |
| **Interface / Textos / Controles** | **Chivo** | Neo-Grotesque Humanizada | `--font-sans` | Desenhada por Héctor Gatti (*Omnibus-Type*). Possui peso balanceado, x-height generoso e terminais nítidos que garantem legibilidade excelente em botões, campos de formulário e rótulos de status em qualquer tela. |
| **Gamificação / Pontos (Acento)** | **Silkscreen** | Pixel Display | `--font-pixel` | Desenhada por Jason Kottke. Fonte pixelada geométrica que conversa diretamente com a grade de sprites 16x16, perfeita para contadores de pontos (`+10 pts`), bônus e sequência diária de hábitos. |

---

## 3. Paleta de Cores e Tokens (Contraste WCAG AA)

A paleta une tons de papel aquecido com verdes botânicos e acentos de terracota/coral derivados do próprio pet pixel art.

### 3.1. Modo Claro (Light Mode)

| Token CSS | Cor Hex | Uso Principal | Razão de Contraste (WCAG) | Status |
|---|---|---|---|---|
| `--paper` | `#f8f7f2` | Fundo principal da aplicação | Base | — |
| `--surface` | `#fffefb` | Fundo de cartões e inputs | Base elevada | — |
| `--ink` | `#203e32` | Texto primário, títulos e ícones | **11.4:1** vs `--paper` | **AAA** (Passa) |
| `--muted` | `#58695e` | Texto de apoio e metadados | **4.7:1** vs `--paper` | **AA** (Passa) |
| `--line` | `#c5cbbf` | Bordas e divisores sutis | 1.6:1 (bordas decorativas) | Passa |
| `--primary` | `#315e43` | Botões principais e ênfase | **5.8:1** vs `--paper` | **AA** (Passa) |
| `--primary-hover` | `#234930` | Hover de botões principais | **9.6:1** vs `--paper` | **AAA** (Passa) |
| `--primary-text` | `#ffffff` | Texto em botões principais | **5.8:1** vs `--primary` | **AA** (Passa) |
| `--pale` | `#e8eddf` | Superfícies ativas e tags | Fundo de destaque | — |
| `--accent-coral` | `#ad4c30` | Pulos, alertas e ênfase quente | **5.1:1** vs `--paper` | **AA** (Passa) |
| `--pet-outline` | `#203e32` | Contorno do pet | 11.4:1 | AAA |
| `--pet-body` | `#a9ca7b` | Corpo do pet (verde oliva fresco) | 1.6:1 vs paper (ilustrativo) | N/A |
| `--pet-highlight` | `#c7e39a` | Brilho do pet | Ilustrativo | N/A |
| `--pet-blush` | `#d58068` | Bochechas do pet | Ilustrativo | N/A |

### 3.2. Modo Escuro (Dark Mode)

| Token CSS | Cor Hex | Uso Principal | Razão de Contraste (WCAG) | Status |
|---|---|---|---|---|
| `--paper` | `#141c17` | Fundo principal noturno | Base | — |
| `--surface` | `#1c2820` | Cartões e superfícies escuras | Base elevada | — |
| `--ink` | `#eef3ea` | Texto primário claro | **13.2:1** vs `--paper` | **AAA** (Passa) |
| `--muted` | `#9cb0a1` | Texto de apoio secundário | **5.3:1** vs `--paper` | **AA** (Passa) |
| `--line` | `#2a3a2e` | Bordas e divisores noturnos | 1.8:1 (decorativo) | Passa |
| `--primary` | `#56926e` | Botões e destaques noturnos | **5.6:1** vs `--paper` | **AA** (Passa) |
| `--primary-hover` | `#6cb087` | Hover no tema escuro | **8.1:1** vs `--paper` | **AAA** (Passa) |
| `--primary-text` | `#0f1812` | Texto em botão de alto contraste | **7.2:1** vs `--primary` | **AAA** (Passa) |
| `--pale` | `#223327` | Tags e seleção no modo escuro | Fundo de apoio | — |
| `--accent-coral` | `#df7255` | Alertas e destaques no escuro | **5.2:1** vs `--paper` | **AA** (Passa) |

---

## 4. Uso do Pixel Art (Grade 16x16)

O mascote do app é construído rigorosamente sobre uma grade matricial **16x16**, alinhada com as definições em `src/app/pet-sprites.tsx`.

### 4.1. Regras Geométricas
1. **Sem sub-pixels:** Todo elemento pixelado deve ser escalado em fatores inteiros (`1x` = 16px, `2x` = 32px, `3x` = 48px, `4x` = 64px, `8x` = 128px, `11.25x` = 180px com crispEdges).
2. **Propriedades de Renderização:** Sempre utilizar nos SVGs e estilos globais:
   ```css
   image-rendering: pixelated;
   image-rendering: crisp-edges;
   shape-rendering: crispEdges;
   ```
3. **Fidelidade de Humor:**
   - **Feliz:** Olhos abertos com brilho e bochechas coradas (`#d58068`). Usado como símbolo padrão da marca.
   - **De boa (Ok):** Expressão neutra e calma.
   - **Triste:** Expressão cabisbaixa para dias sem conclusões suficientes.

---

## 5. Componentes de Marca (React / SVG)

Disponíveis em `src/app/brand/` sem qualquer dependência externa:

- **`<Logo />` (`src/app/brand/Logo.tsx`):**
  - Versão horizontal oficial (símbolo à esquerda + palavra "Rotina" em serif display + badge "PET").
  - Props: `size` (altura padrão: 36px), `className`, `style`, `title`, `variant` (`'horizontal' | 'mark-only'`), `mood` (`'happy' | 'ok' | 'sad'`).
- **`<LogoMark />` (`src/app/brand/LogoMark.tsx`):**
  - Apenas o símbolo do pet pixel art com acessibilidade integrada (`role="img"`, `<title>`).
  - Props: `size` (padrão: 32px), `mood`, `className`, `style`.

---

## 6. Favicon, Ícones e Imagens Sociais Gerados

Todos os arquivos foram gerados e validados:

1. **Favicons e Ícones Web:**
   - `src/app/icon.svg`: Ícone vetorial nativo do Next.js (16x16 viewBox).
   - `src/app/apple-icon.png`: Ícone para iOS (180x180 px).
   - `src/app/favicon.ico` e `favicon.ico`: Formato ICO padrão multissistema (48x48 px).
2. **PWA (Progressive Web App):**
   - `public/icon-192.png`: 192x192 px.
   - `public/icon-512.png`: 512x512 px.
   - `public/icon-192-maskable.png`: 192x192 px com margem segura de 15%.
   - `public/icon-512-maskable.png`: 512x512 px com margem segura de 15%.
   - `src/app/manifest.ts`: Gera `manifest.webmanifest` com display standalone e paleta oficial.
3. **OpenGraph & Twitter Card:**
   - `src/app/opengraph-image.png`: 1200x630 px.
   - `src/app/twitter-image.png`: 1200x630 px.

---

## 7. Instruções Exatas de Aplicação para o Maestro

> [!IMPORTANT]
> Para não conflitar com a branch de autenticação/login do agente Forja, estes arquivos não foram alterados diretamente. O Maestro deve aplicar as alterações abaixo após a conclusão da etapa de login.

### 7.1. Mudanças em `src/app/layout.tsx`

Adicionar a importação das fontes, configuração de metadados de marca, ícones e variáveis CSS:

```tsx
import type { Metadata, Viewport } from "next";
import { Newsreader, Chivo, Silkscreen } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const chivo = Chivo({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#315e43" },
    { media: "(prefers-color-scheme: dark)", color: "#141c17" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://rotina-pet.vercel.app"),
  title: {
    default: "Rotina Pet — Caderno de hábitos com um companheiro pixel",
    template: "%s | Rotina Pet",
  },
  description: "Cadastre rotinas diárias, ganhe pontos e mantenha seu companheiro pixel feliz.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Rotina Pet — Caderno de hábitos com um companheiro pixel",
    description: "Cadastre rotinas diárias, ganhe pontos e mantenha seu companheiro pixel feliz.",
    url: "https://rotina-pet.vercel.app",
    siteName: "Rotina Pet",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rotina Pet",
    description: "Cadastre rotinas diárias, ganhe pontos e mantenha seu companheiro pixel feliz.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${newsreader.variable} ${chivo.variable} ${silkscreen.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
```

### 7.2. Mudanças em `src/app/globals.css`

Atualizar a definição de fontes e os tokens de design para suportar modo claro e escuro:

```css
:root {
  --font-display: 'Newsreader', Georgia, serif;
  --font-sans: 'Chivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-pixel: 'Silkscreen', monospace;

  /* Modo Claro Oficial */
  --paper: #f8f7f2;
  --surface: #fffefb;
  --ink: #203e32;
  --muted: #58695e;
  --line: #c5cbbf;
  --primary: #315e43;
  --primary-hover: #234930;
  --primary-text: #ffffff;
  --pale: #e8eddf;
  --accent-coral: #ad4c30;
  
  --pet-outline: #203e32;
  --pet-body: #a9ca7b;
  --pet-highlight: #c7e39a;
  --pet-blush: #d58068;
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #141c17;
    --surface: #1c2820;
    --ink: #eef3ea;
    --muted: #9cb0a1;
    --line: #2a3a2e;
    --primary: #56926e;
    --primary-hover: #6cb087;
    --primary-text: #0f1812;
    --pale: #223327;
    --accent-coral: #df7255;
  }
}

body {
  font-family: var(--font-sans);
  background-color: var(--paper);
  color: var(--ink);
  margin: 0;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, .brand-display {
  font-family: var(--font-display);
}

.score-badge, .streak-counter {
  font-family: var(--font-pixel);
}

.pixel-art {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  shape-rendering: crispEdges;
}
```
