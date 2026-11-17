import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { Logo, LogoMark } from '../src/app/brand';
import { AuthPage } from '../src/app/auth-page';
import manifest from '../src/app/manifest';
import { proxy, config, isPublicAsset } from '../src/proxy';
import { routeRedirect } from '../src/auth/contracts';

const ROOT = path.resolve(import.meta.dirname, '..');

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < signature.length; i++) {
    assert.equal(buf[i], signature[i], `Assinatura PNG inválida em ${filePath}`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test('BRAND.md existe e contém as seções obrigatórias da identidade visual', () => {
  const brandPath = path.join(ROOT, 'BRAND.md');
  assert.ok(fs.existsSync(brandPath), 'BRAND.md deve existir');

  const content = fs.readFileSync(brandPath, 'utf8');
  assert.ok(content.includes('Rotina Pet'), 'Deve conter o nome do produto');
  assert.ok(content.includes('Tagline') || content.includes('tagline'), 'Deve conter a tagline');
  assert.ok(content.includes('Personalidade'), 'Deve conter a personalidade');
  assert.ok(content.includes('Paleta') || content.includes('Tokens'), 'Deve conter a paleta de cores');
  assert.ok(content.includes('Tipografia') || content.includes('tipografia'), 'Deve conter a seção de tipografia');
  assert.ok(content.includes('Pixel Art') || content.includes('16x16'), 'Deve conter as regras de pixel art');
  assert.ok(content.includes('layout.tsx'), 'Deve especificar as alterações exatas para layout.tsx');
  assert.ok(content.includes('globals.css'), 'Deve especificar as alterações exatas para globals.css');
});

test('Componentes React de Brand (Logo e LogoMark) renderizam SVG válido sem erros', () => {
  const markHtml = renderToStaticMarkup(React.createElement(LogoMark, { size: 48, mood: 'feliz' }));
  assert.ok(markHtml.startsWith('<svg'), 'LogoMark deve renderizar um elemento <svg>');
  assert.ok(markHtml.includes('viewBox="0 0 16 16"'), 'LogoMark deve ter viewBox 0 0 16 16');
  assert.ok(markHtml.includes('shape-rendering="crispEdges"'), 'LogoMark deve manter renderização nítida de pixel');

  const logoHtml = renderToStaticMarkup(React.createElement(Logo, { size: 36, mood: 'feliz' }));
  assert.ok(logoHtml.startsWith('<svg'), 'Logo deve renderizar um elemento <svg>');
  assert.ok(logoHtml.includes('Rotina'), 'Logo horizontal deve conter o texto Rotina');
  assert.ok(logoHtml.includes('PET'), 'Logo horizontal deve conter o texto PET');
});

test('AuthPage renderiza o componente Logo no cabeçalho auth-topbar', () => {
  const html = renderToStaticMarkup(React.createElement(AuthPage, { signup: false }));
  assert.ok(html.includes('class="topbar auth-topbar"'), 'AuthPage deve conter cabeçalho auth-topbar');
  assert.ok(html.includes('aria-label="Rotina Pet"'), 'Link da marca deve ter aria-label acessível');
  assert.ok(html.includes('viewBox="0 0 160 36"'), 'Deve conter o SVG do componente Logo');
});

test('Todos os arquivos de ícones e imagens sociais existem com dimensões corretas', () => {
  // 1. icon.svg
  const svgPath = path.join(ROOT, 'src', 'app', 'icon.svg');
  assert.ok(fs.existsSync(svgPath), 'src/app/icon.svg deve existir');
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  assert.ok(svgContent.includes('viewBox="0 0 16 16"'), 'icon.svg deve ter viewBox 0 0 16 16');

  // 2. apple-icon.png (180x180)
  const applePath = path.join(ROOT, 'src', 'app', 'apple-icon.png');
  assert.ok(fs.existsSync(applePath), 'src/app/apple-icon.png deve existir');
  const appleDims = readPngDimensions(applePath);
  assert.deepEqual(appleDims, { width: 180, height: 180 });

  // 3. favicon.ico
  const icoPath = path.join(ROOT, 'src', 'app', 'favicon.ico');
  assert.ok(fs.existsSync(icoPath), 'src/app/favicon.ico deve existir');
  assert.ok(fs.statSync(icoPath).size > 0, 'favicon.ico não pode estar vazio');

  // 4. public/ PWA icons
  const pwa192 = path.join(ROOT, 'public', 'icon-192.png');
  assert.ok(fs.existsSync(pwa192), 'public/icon-192.png deve existir');
  assert.deepEqual(readPngDimensions(pwa192), { width: 192, height: 192 });

  const pwa512 = path.join(ROOT, 'public', 'icon-512.png');
  assert.ok(fs.existsSync(pwa512), 'public/icon-512.png deve existir');
  assert.deepEqual(readPngDimensions(pwa512), { width: 512, height: 512 });

  const pwa192Maskable = path.join(ROOT, 'public', 'icon-192-maskable.png');
  assert.ok(fs.existsSync(pwa192Maskable), 'public/icon-192-maskable.png deve existir');
  assert.deepEqual(readPngDimensions(pwa192Maskable), { width: 192, height: 192 });

  const pwa512Maskable = path.join(ROOT, 'public', 'icon-512-maskable.png');
  assert.ok(fs.existsSync(pwa512Maskable), 'public/icon-512-maskable.png deve existir');
  assert.deepEqual(readPngDimensions(pwa512Maskable), { width: 512, height: 512 });

  // 5. OpenGraph & Twitter image (1200x630)
  const ogPath = path.join(ROOT, 'src', 'app', 'opengraph-image.png');
  assert.ok(fs.existsSync(ogPath), 'src/app/opengraph-image.png deve existir');
  assert.deepEqual(readPngDimensions(ogPath), { width: 1200, height: 630 });

  const twPath = path.join(ROOT, 'src', 'app', 'twitter-image.png');
  assert.ok(fs.existsSync(twPath), 'src/app/twitter-image.png deve existir');
  assert.deepEqual(readPngDimensions(twPath), { width: 1200, height: 630 });
});

test('manifest.ts exporta configuração válida para PWA standalone', () => {
  const data = manifest();
  assert.equal(data.name, 'Rotina Pet');
  assert.equal(data.short_name, 'RotinaPet');
  assert.equal(data.display, 'standalone');
  assert.equal(data.start_url, '/');
  assert.equal(data.background_color, '#f8f7f2');
  assert.equal(data.theme_color, '#315e43');
  assert.ok(Array.isArray(data.icons), 'icons deve ser um array');
  assert.ok(data.icons!.length >= 4, 'Deve conter ao menos 4 ícones PWA');

  const purposes = data.icons!.map((icon) => icon.purpose);
  assert.ok(purposes.includes('any'), 'Deve conter ícone com purpose any');
  assert.ok(purposes.includes('maskable'), 'Deve conter ícone com purpose maskable');
});

test('Contraste de cores atende integralmente ao padrão WCAG AA em ambos os temas', () => {
  // Modo Claro
  const lightInkVsPaper = contrastRatio('#203e32', '#f8f7f2');
  assert.ok(lightInkVsPaper >= 7.0, `Ink no modo claro deve ser AAA (obtido: ${lightInkVsPaper.toFixed(2)})`);

  const lightMutedVsPaper = contrastRatio('#58695e', '#f8f7f2');
  assert.ok(lightMutedVsPaper >= 4.5, `Muted no modo claro deve ser AA >= 4.5:1 (obtido: ${lightMutedVsPaper.toFixed(2)})`);

  const lightPrimaryText = contrastRatio('#ffffff', '#315e43');
  assert.ok(lightPrimaryText >= 4.5, `Texto de botão no modo claro deve ser AA >= 4.5:1 (obtido: ${lightPrimaryText.toFixed(2)})`);

  // Modo Escuro
  const darkInkVsPaper = contrastRatio('#eef3ea', '#141c17');
  assert.ok(darkInkVsPaper >= 7.0, `Ink no modo escuro deve ser AAA (obtido: ${darkInkVsPaper.toFixed(2)})`);

  const darkMutedVsPaper = contrastRatio('#9cb0a1', '#141c17');
  assert.ok(darkMutedVsPaper >= 4.5, `Muted no modo escuro deve ser AA >= 4.5:1 (obtido: ${darkMutedVsPaper.toFixed(2)})`);

  const darkPrimaryText = contrastRatio('#0f1812', '#56926e');
  assert.ok(darkPrimaryText >= 4.5, `Texto de botão no modo escuro deve ser AA >= 4.5:1 (obtido: ${darkPrimaryText.toFixed(2)})`);
});

test('Layout e estilos globais garantem responsividade móvel sem overflow e suporte a reduced-motion', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src', 'app', 'globals.css'), 'utf8');

  // Prevenção de overflow horizontal
  assert.ok(css.includes('overflow-x: hidden'), 'globals.css deve definir overflow-x: hidden');
  assert.ok(css.includes('max-width: 100vw'), 'globals.css deve limitar largura máxima a 100vw');

  // Quebra flexível do cabeçalho em telas estreitas
  assert.ok(css.includes('flex-wrap: wrap'), 'Cabeçalho e navegação devem ter flex-wrap: wrap');

  // Suporte a acessibilidade de movimento reduzido
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'globals.css deve conter regra prefers-reduced-motion: reduce');
  assert.ok(css.includes('animation: none'), 'Modo reduce deve desativar animações');
});

test('Proxy e matcher excluem assets públicos e continuam protegendo rotas privadas', async () => {
  const matcherRegex = new RegExp(`^${config.matcher[0].replace('/((?!', '/(?!').replace(').*)', ').*')}$`);

  const publicAssets = [
    '/favicon.ico',
    '/icon.svg',
    '/apple-icon.png',
    '/manifest.webmanifest',
    '/icon-192.png',
    '/icon-512.png',
    '/icon-192-maskable.png',
    '/icon-512-maskable.png',
    '/opengraph-image',
    '/opengraph-image.png',
    '/twitter-image',
    '/twitter-image.png',
    '/robots.txt',
    '/sitemap.xml',
  ];

  // 1. Assets públicos são reconhecidos e excluídos do matcher do proxy
  for (const asset of publicAssets) {
    assert.equal(isPublicAsset(asset), true, `${asset} deve ser reconhecido como asset público`);
    assert.equal(matcherRegex.test(asset), false, `${asset} deve ser excluído pelo matcher do middleware`);
    const req = new NextRequest(`http://localhost:3000${asset}`);
    const res = await proxy(req);
    assert.equal(res.headers.get('location'), null, `${asset} não deve redirecionar anônimo`);
  }

  // 2. Rotas protegidas (dados, home, rotinas, api) continuam no matcher e redirecionam anônimo
  const protectedRoutes = ['/', '/rotinas', '/rotinas/qualquer', '/api/dados', '/api/auth/session'];
  for (const route of protectedRoutes) {
    assert.equal(isPublicAsset(route), false, `${route} não deve ser considerado asset público`);
    assert.equal(matcherRegex.test(route), true, `${route} deve ser capturado pelo matcher do middleware`);
    if (route === '/' || route.startsWith('/rotinas')) {
      assert.equal(routeRedirect(route, null), '/entrar', `Anônimo em ${route} deve redirecionar para /entrar`);
    }
  }
});

test('src/app/actions.ts usa mensagem neutra sem expor termos internos de infraestrutura ou banco', () => {
  const actionsSource = fs.readFileSync(path.join(ROOT, 'src', 'app', 'actions.ts'), 'utf8');
  assert.ok(!actionsSource.includes('banco local'), 'actions.ts não deve citar "banco local"');
  assert.ok(actionsSource.includes('Não foi possível salvar.'), 'actions.ts deve conter mensagem neutra');
});
