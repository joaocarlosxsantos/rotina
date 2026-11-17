import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const CSS_PATH = path.join(ROOT, 'src', 'app', 'globals.css');
const PAGE_PATH = path.join(ROOT, 'src', 'app', 'page.tsx');
const HEADER_PATH = path.join(ROOT, 'src', 'app', 'header.tsx');
const PETS_PATH = path.join(ROOT, 'src', 'app', 'pets', 'page.tsx');
const css = fs.readFileSync(CSS_PATH, 'utf8');

type Tokens = Map<string, string>;
type Pair = { name: string; fg: string; bg: string; min: number };

const TEXT = 4.5;
const UI = 3;

const PAIRS: Pair[] = [
  { name: 'texto do corpo no papel', fg: 'ink', bg: 'paper', min: TEXT },
  { name: 'texto do corpo na superfície', fg: 'ink', bg: 'surface', min: TEXT },
  { name: 'texto do corpo no painel', fg: 'ink', bg: 'pale', min: TEXT },
  { name: 'texto secundário no papel', fg: 'muted', bg: 'paper', min: TEXT },
  { name: 'texto secundário na superfície', fg: 'muted', bg: 'surface', min: TEXT },
  { name: 'texto secundário no painel', fg: 'muted', bg: 'pale', min: TEXT },
  { name: 'link no papel', fg: 'link', bg: 'paper', min: TEXT },
  { name: 'link na superfície', fg: 'link', bg: 'surface', min: TEXT },
  { name: 'link no painel', fg: 'link', bg: 'pale', min: TEXT },
  { name: 'texto secundário no palco', fg: 'muted', bg: 'paper-muted', min: TEXT },
  { name: 'link em hover no papel', fg: 'link-hover', bg: 'paper', min: TEXT },
  { name: 'link em hover na superfície', fg: 'link-hover', bg: 'surface', min: TEXT },
  { name: 'texto do aviso', fg: 'notice-text', bg: 'notice-soft', min: TEXT },
  { name: 'texto do aviso de erro', fg: 'danger-text', bg: 'danger-soft', min: TEXT },
  { name: 'texto do aviso de sucesso', fg: 'success-text', bg: 'success-soft', min: TEXT },
  { name: 'texto do campo', fg: 'input-text', bg: 'input-bg', min: TEXT },
  { name: 'placeholder do campo', fg: 'input-placeholder', bg: 'input-bg', min: TEXT },
  { name: 'texto do campo desabilitado', fg: 'input-disabled-text', bg: 'input-disabled-bg', min: TEXT },
  { name: 'texto do badge', fg: 'badge-text', bg: 'badge-bg', min: TEXT },
  { name: 'texto do badge feliz', fg: 'badge-happy-text', bg: 'badge-happy-bg', min: TEXT },
  { name: 'texto do badge triste', fg: 'badge-sad-text', bg: 'badge-sad-bg', min: TEXT },
  { name: 'botão primário', fg: 'primary-text', bg: 'primary', min: TEXT },
  { name: 'botão primário em hover', fg: 'primary-text', bg: 'primary-hover', min: TEXT },
  { name: 'botão primário em active', fg: 'primary-text', bg: 'primary-active', min: TEXT },
  { name: 'botão fantasma no papel', fg: 'green', bg: 'paper', min: TEXT },
  { name: 'botão fantasma em hover', fg: 'primary-hover', bg: 'pale', min: TEXT },
  { name: 'botão fantasma em active', fg: 'primary-active', bg: 'pale-strong', min: TEXT },
  { name: 'texto de perigo no papel', fg: 'danger-text', bg: 'paper', min: TEXT },
  { name: 'texto de perigo na superfície', fg: 'danger-text', bg: 'surface', min: TEXT },
  { name: 'texto de sucesso no papel', fg: 'success-text', bg: 'paper', min: TEXT },
  { name: 'texto de sucesso na superfície', fg: 'success-text', bg: 'surface', min: TEXT },
  { name: 'item ativo da navegação', fg: 'selection-text', bg: 'selection-bg', min: TEXT },
  { name: 'item ativo da barra de abas', fg: 'selection-text', bg: 'selection-bg', min: TEXT },
  { name: 'texto desabilitado no painel', fg: 'disabled-text', bg: 'pale', min: TEXT },
  { name: 'botão desabilitado', fg: 'disabled-text', bg: 'disabled-bg', min: TEXT },
  { name: 'badge do pet atual', fg: 'primary-text', bg: 'green', min: TEXT },
  { name: 'texto do pet atual', fg: 'ink', bg: 'pale', min: TEXT },
  { name: 'borda do campo com erro', fg: 'input-error-border', bg: 'input-bg', min: UI },
  { name: 'borda do campo', fg: 'input-border', bg: 'input-bg', min: UI },
  { name: 'borda do campo em foco', fg: 'input-border-focus', bg: 'input-bg', min: UI },
  { name: 'borda do botão primário no papel', fg: 'primary', bg: 'paper', min: UI },
  { name: 'borda do botão primário na superfície', fg: 'primary', bg: 'surface', min: UI },
  { name: 'borda do botão primário em hover', fg: 'primary-hover', bg: 'paper', min: UI },
  { name: 'borda do botão primário em active', fg: 'primary-active', bg: 'paper', min: UI },
  { name: 'borda do botão fantasma', fg: 'green', bg: 'paper', min: UI },
  { name: 'borda do botão de perigo no papel', fg: 'danger', bg: 'paper', min: UI },
  { name: 'borda do botão de perigo na superfície', fg: 'danger', bg: 'surface', min: UI },
  { name: 'borda do botão desabilitado no fundo', fg: 'disabled-border', bg: 'disabled-bg', min: UI },
  { name: 'borda do botão desabilitado no papel', fg: 'disabled-border', bg: 'paper', min: UI },
  { name: 'borda do botão desabilitado na superfície', fg: 'disabled-border', bg: 'surface', min: UI },
  { name: 'borda do badge', fg: 'badge-border', bg: 'badge-bg', min: UI },
  { name: 'borda do badge feliz', fg: 'badge-happy-text', bg: 'badge-happy-bg', min: UI },
  { name: 'borda do badge triste', fg: 'badge-sad-text', bg: 'badge-sad-bg', min: UI },
  { name: 'separador no papel', fg: 'line', bg: 'paper', min: UI },
  { name: 'separador na superfície', fg: 'line', bg: 'surface', min: UI },
  { name: 'separador no painel', fg: 'line', bg: 'pale', min: UI },
  { name: 'borda do palco', fg: 'line', bg: 'paper-muted', min: UI },
  { name: 'borda do pet atual', fg: 'green', bg: 'pale', min: UI },
  { name: 'borda desabilitada no painel', fg: 'disabled-border', bg: 'pale', min: UI },
  { name: 'borda do aviso', fg: 'line', bg: 'notice-soft', min: UI },
  { name: 'marca da marca no papel', fg: 'accent-coral', bg: 'paper', min: UI },
  { name: 'marca da marca na superfície', fg: 'accent-coral', bg: 'surface', min: UI },
  { name: 'caret do campo', fg: 'input-caret', bg: 'input-bg', min: UI },
  { name: 'preenchimento da barra de progresso', fg: 'progress-fill', bg: 'progress-track', min: UI },
  { name: 'anel de foco no papel', fg: 'focus-ring', bg: 'paper', min: UI },
  { name: 'anel de foco na superfície', fg: 'focus-ring', bg: 'surface', min: UI },
  { name: 'anel de foco no painel', fg: 'focus-ring', bg: 'pale', min: UI },
  { name: 'anel de foco no erro', fg: 'focus-ring', bg: 'danger-soft', min: UI },
  { name: 'anel de foco no sucesso', fg: 'focus-ring', bg: 'success-soft', min: UI },
  { name: 'anel de foco no desabilitado', fg: 'focus-ring', bg: 'disabled-bg', min: UI },
  { name: 'anel de foco no item ativo', fg: 'focus-ring', bg: 'selection-bg', min: UI },
  { name: 'halo de foco no primário', fg: 'focus-halo', bg: 'primary', min: UI },
  { name: 'halo de foco no primário em hover', fg: 'focus-halo', bg: 'primary-hover', min: UI },
  { name: 'halo de foco no primário em active', fg: 'focus-halo', bg: 'primary-active', min: UI },
  { name: 'halo de foco no perigo', fg: 'focus-halo', bg: 'danger', min: UI },
  { name: 'halo de foco no fantasma', fg: 'focus-halo', bg: 'green', min: UI },
];

function parseTokens(source: string): Tokens {
  const tokens: Tokens = new Map();
  for (const match of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
}

function themeTokens(match: RegExpMatchArray | null, label: string): Tokens {
  assert.ok(match?.[1], `Bloco de tokens ${label} não encontrado em globals.css`);
  return parseTokens(match[1]);
}

function resolveColor(token: string, tokens: Tokens): string {
  const raw = tokens.get(token) ?? tokens.get(`--${token}`);
  assert.ok(raw, `Token ${token} não encontrado em globals.css`);
  const variable = raw.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (variable) return resolveColor(variable[1], tokens);
  assert.match(raw, /^#[0-9a-f]{6}$/i, `Token ${token} não é uma cor hexadecimal: ${raw}`);
  return raw;
}

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  assert.ok(match?.[1], `Regra ${selector} não encontrada em globals.css`);
  return match[1];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function luminance(hex: string): number {
  const channels = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('todos os pares de texto, borda e foco passam no contraste AA nos temas claro e escuro', () => {
  const light = themeTokens(css.match(/:root\s*\{([\s\S]*?)\n\}/), 'claro');
  const dark = themeTokens(
    css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}/),
    'escuro',
  );

  const failures: string[] = [];
  for (const [theme, tokens] of [
    ['claro', light],
    ['escuro', dark],
  ] as const) {
    for (const pair of PAIRS) {
      const foreground = resolveColor(pair.fg, tokens);
      const background = resolveColor(pair.bg, tokens);
      const ratio = contrastRatio(foreground, background);
      if (ratio < pair.min) {
        failures.push(
          `${theme}: ${pair.name} (${pair.fg} sobre ${pair.bg}) ${ratio.toFixed(2)}:1 < ${pair.min}:1`,
        );
      }
    }
  }

  assert.deepEqual(failures, [], `Pares de contraste fora do AA:\n${failures.join('\n')}`);
});

test('botões e links mantêm estados hover, active, disabled e foco distinguishable', () => {
  assert.match(css, /a\s*\{[\s\S]*?color:\s*var\(--link\);[\s\S]*?text-decoration:\s*underline;/);
  assert.match(css, /button:active:not\(:disabled\)\s*\{[\s\S]*?var\(--primary-active\)/);
  assert.match(css, /button:disabled\s*\{[\s\S]*?var\(--disabled-text\)[\s\S]*?var\(--disabled-border\)/);
  assert.match(css, /\.skip-activity:active:not\(:disabled\)\s*\{[\s\S]*?var\(--danger\)/);
  assert.match(css, /\.inline-form button:active:not\(:disabled\)\s*\{[\s\S]*?var\(--primary-active\)/);
  assert.match(css, /button:focus-visible,\s*a:focus-visible,\s*summary:focus-visible\s*\{[\s\S]*?outline:\s*3px solid var\(--focus-ring\)/);
  assert.match(css, /button:focus-visible\s*\{\s*box-shadow:\s*0 0 0 3px var\(--focus-halo\);/);
});

test('navegação da Fase 8 usa tokens AA, foco 3px e estados não apenas por cor', () => {
  assert.match(ruleBody('.desktop-nav a'), /color:\s*var\(--link\)/);
  assert.match(ruleBody('.desktop-nav a:hover'), /color:\s*var\(--link-hover\)/);

  const desktopActive = css.match(
    /\.desktop-nav a\[aria-current="page"\],\s*\.desktop-nav a\.active\s*\{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(desktopActive, 'Estado ativo do menu desktop não encontrado');
  assert.match(desktopActive, /var\(--selection-text\)/);
  assert.match(desktopActive, /var\(--selection-bg\)/);
  assert.match(desktopActive, /text-decoration:\s*underline/);
  assert.match(
    ruleBody('.desktop-nav a:focus-visible'),
    /outline:\s*3px solid var\(--focus-ring\)/,
  );

  const disabledNav = ruleBody('.nav-link-disabled');
  assert.match(disabledNav, /min-height:\s*44px/);
  assert.match(disabledNav, /var\(--disabled-text\)/);
  assert.match(disabledNav, /var\(--disabled-bg\)/);
  assert.match(disabledNav, /var\(--disabled-border\)/);
  assert.doesNotMatch(disabledNav, /opacity:/);
  assert.match(ruleBody('.badge-soon'), /font-size:\s*var\(--text-small\)/);
  assert.match(ruleBody('.user-email'), /font-size:\s*var\(--text-small\)/);

  const header = fs.readFileSync(HEADER_PATH, 'utf8');
  assert.ok(header.includes('href="/calendario"'), 'Calendário deve estar habilitado como link para /calendario');
});

test('barra de abas e /pets usam tokens AA, alvos de 44px e fonte de 14px', () => {
  const tab = ruleBody('.tab-item');
  assert.match(tab, /color:\s*var\(--link\)/);
  assert.match(tab, /font-size:\s*var\(--text-small\)/);
  assert.match(tab, /min-height:\s*56px/);
  assert.match(ruleBody('.tab-item:focus-visible'), /outline:\s*3px solid var\(--focus-ring\)/);

  const activeTab = css.match(
    /\.tab-item\[aria-current="page"\],\s*\.tab-item\.active\s*\{([\s\S]*?)\n\s*\}/,
  )?.[1];
  assert.ok(activeTab, 'Estado ativo da barra de abas não encontrado');
  assert.match(activeTab, /var\(--selection-text\)/);
  assert.match(activeTab, /var\(--selection-bg\)/);
  assert.match(activeTab, /text-decoration:\s*underline/);

  const disabledTab = ruleBody('.tab-item.tab-disabled');
  assert.match(disabledTab, /var\(--disabled-text\)/);
  assert.match(disabledTab, /var\(--disabled-bg\)/);
  assert.match(disabledTab, /var\(--disabled-border\)/);
  assert.doesNotMatch(disabledTab, /opacity:/);
  assert.match(ruleBody('.tab-badge'), /font-size:\s*var\(--text-small\)/);

  assert.match(ruleBody('.badge-current'), /color:\s*var\(--primary-text\)/);
  assert.match(ruleBody('.pet-preview-stage'), /background:\s*var\(--paper-muted\)/);
  assert.match(ruleBody('.preview-mood-label'), /font-size:\s*var\(--text-small\)/);
  assert.match(ruleBody('.pet-status-active'), /color:\s*var\(--primary-text\)/);
  assert.match(ruleBody('.choose-btn'), /min-height:\s*48px/);
  assert.match(ruleBody('.choose-btn'), /color:\s*var\(--primary-text\)/);
  assert.match(
    css,
    /\.choose-btn:hover:not\(:disabled\)\s*\{[\s\S]*?background:\s*var\(--primary-hover\)/,
  );
  assert.match(
    ruleBody('.choose-btn:focus-visible'),
    /outline:\s*3px solid var\(--focus-ring\)/,
  );

  const petsPage = fs.readFileSync(PETS_PATH, 'utf8');
  assert.ok(petsPage.includes('✓ Companheiro ativo'), 'Pet atual deve ter sinal textual');
  assert.ok(
    petsPage.includes('aria-label="Pet atualmente selecionado"'),
    'Badge do pet atual precisa de rótulo',
  );
});

test('tipos e alvos de toque respeitam 14px, 16px e 44px', () => {
  assert.match(css, /font-size:\s*1rem;/);
  assert.match(css, /--text-small:\s*0\.875rem;/);
  assert.match(css, /nav a\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /button\s*\{[\s\S]*?min-height:\s*48px;/);
  assert.match(css, /input\s*\{[\s\S]*?min-height:\s*48px;/);
  assert.match(css, /summary\s*\{[\s\S]*?min-height:\s*48px;/);
  assert.match(css, /\.password-toggle,\s*\.logout\s*\{[\s\S]*?min-height:\s*44px;/);

  const tooSmall = [...css.matchAll(/font-size:\s*([0-9]*\.?[0-9]+)(rem|px)/gi)]
    .map((match) => ({ value: Number(match[1]), unit: match[2], raw: match[0] }))
    .filter(({ value, unit }) => (unit === 'rem' ? value < 0.875 : value < 14));
  assert.deepEqual(tooSmall, [], `Fontes abaixo de 14px:\n${tooSmall.map((item) => item.raw).join('\n')}`);
});

test('status e histórico de pontos não dependem apenas da cor', () => {
  assert.match(css, /\.done \.activity-name\s*\{[\s\S]*?text-decoration:\s*line-through/);
  assert.match(css, /\.done \.activity-name::before\s*\{\s*content:\s*"✓ ";/);
  assert.match(css, /\.skipped \.activity-name::before\s*\{\s*content:\s*"⊘ ";/);
  assert.match(css, /\.points-history \.point-change\s*\{[\s\S]*?font-weight:\s*700;/);

  const page = fs.readFileSync(PAGE_PATH, 'utf8');
  assert.ok(page.includes('event.points >= 0 ? "+" : ""'), 'Histórico deve manter o sinal numérico');
});

test('cores de interface ficam centralizadas nos tokens do globals.css', () => {
  const outsideTokens = css
    .split('\n')
    .filter((line) => !/^\s*--[a-z0-9-]+\s*:/i.test(line))
    .filter((line) => /#[0-9a-f]{3,8}\b/i.test(line));
  assert.deepEqual(outsideTokens, [], `CoresFixasForaDosTokens:\n${outsideTokens.join('\n')}`);
});

test('B8 & B9: Componentes de calendário usam tokens AA, sem opacity em special card e com flex-wrap', () => {
  assert.match(css, /\.calendar-day-header\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(css, /\.calendar-day-header\s*\{[\s\S]*?min-width:\s*0;/);

  assert.match(css, /\.event-special-card\s*\{[\s\S]*?background:\s*var\(--surface\);/);
  assert.doesNotMatch(css, /\.event-special-card\s*\{[\s\S]*?opacity:/, 'event-special-card não deve ter opacity para preservar contraste AA');

  assert.match(css, /\.event-multiday-badge\s*\{[\s\S]*?color:\s*var\(--muted\);/);
  assert.match(css, /\.event-multiday-badge\s*\{[\s\S]*?background:\s*var\(--pale\);/);
  assert.match(css, /\.event-multiday-badge\s*\{[\s\S]*?font-size:\s*var\(--text-small\);/);
});

