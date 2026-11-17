import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Logo, LogoMark } from '../src/app/brand';
import manifest from '../src/app/manifest';

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
  const markHtml = renderToStaticMarkup(React.createElement(LogoMark, { size: 48 }));
  assert.ok(markHtml.startsWith('<svg'), 'LogoMark deve renderizar um elemento <svg>');
  assert.ok(markHtml.includes('viewBox="0 0 16 16"'), 'LogoMark deve ter viewBox 0 0 16 16');
  assert.ok(markHtml.includes('shape-rendering="crispEdges"'), 'LogoMark deve manter renderização nítida de pixel');

  const logoHtml = renderToStaticMarkup(React.createElement(Logo, { size: 36 }));
  assert.ok(logoHtml.startsWith('<svg'), 'Logo deve renderizar um elemento <svg>');
  assert.ok(logoHtml.includes('Rotina'), 'Logo horizontal deve conter o texto Rotina');
  assert.ok(logoHtml.includes('PET'), 'Logo horizontal deve conter o texto PET');
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
