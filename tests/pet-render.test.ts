import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { petMood } from "../src/lib/rules";
import { Pet } from "../src/app/pet";
import {
  normalizeSize,
  PetHappy,
  PetOk,
  PetSad,
} from "../src/app/pet-sprites";

type PetMood = ReturnType<typeof petMood>;

const TERMS: Record<PetMood, string> = {
  feliz: "Feliz",
  ok: "De boa",
  triste: "Triste",
};

const CASES = [
  { mood: "feliz", Sprite: PetHappy, label: "Ursinho — Pet feliz" },
  { mood: "ok", Sprite: PetOk, label: "Ursinho — Pet de boa" },
  { mood: "triste", Sprite: PetSad, label: "Ursinho — Pet triste" },
] as const;

function renderPet(mood: PetMood): string {
  return renderToStaticMarkup(React.createElement(Pet, { mood }));
}

function blockAfter(source: string, marker: RegExp): string {
  const match = marker.exec(source);
  assert.ok(match, `Bloco CSS não encontrado: ${String(marker)}`);
  const start = (match.index ?? 0) + match[0].length;
  let depth = 1;

  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index);
    }
  }

  throw new Error(`Bloco CSS não fechado: ${String(marker)}`);
}

function keyframeBlocks(source: string): Array<{ name: string; body: string }> {
  const blocks: Array<{ name: string; body: string }> = [];

  for (const match of source.matchAll(/@keyframes\s+(pet-[\w-]+)\s*\{/g)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 1;

    const name = match[1];
    if (!name) continue;

    for (let index = start; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push({ name, body: source.slice(start, index) });
          break;
        }
      }
    }
  }

  return blocks;
}

test("Pet usa o sprite e o rótulo do humor recebido", () => {
  for (const { mood, Sprite, label } of CASES) {
    const markup = renderPet(mood);
    const expected = renderToStaticMarkup(
      React.createElement(Sprite, { className: `pet pet-${mood}`, label }),
    );

    assert.equal(markup, expected);
  }
});

test("Pet expõe role e texto alternativo do humor", () => {
  for (const { mood, label } of CASES) {
    const markup = renderPet(mood);

    assert.ok(markup.startsWith("<svg"));
    assert.ok(markup.includes(`class="pet pet-${mood}"`));
    assert.ok(markup.includes('role="img"'));
    assert.ok(markup.includes(`aria-label="${label}"`));
    assert.ok(!markup.includes("aria-hidden"));
    assert.ok(!markup.includes("<path"));
  }
});

test("Rótulo acessível usa o mesmo termo do texto visível", () => {
  const page = readFileSync(
    resolve(process.cwd(), "src/app/page.tsx"),
    "utf8",
  );

  for (const [mood, term] of Object.entries(TERMS) as Array<
    [PetMood, string]
  >) {
    assert.ok(page.includes(`"${term}"`), `Termo visível ausente: ${term}`);
    assert.ok(
      renderPet(mood).includes(`aria-label="Ursinho — Pet ${term.toLowerCase()}"`),
    );
  }
});

test("Humor de petMood chega ao rótulo nos limites de progresso", () => {
  const limits = [
    { done: 0, mood: "triste" },
    { done: 39, mood: "triste" },
    { done: 40, mood: "ok" },
    { done: 69, mood: "ok" },
    { done: 70, mood: "feliz" },
    { done: 100, mood: "feliz" },
  ] as const;

  for (const { done, mood } of limits) {
    assert.equal(petMood(done, 100), mood);
    assert.ok(
      renderPet(mood).includes(`aria-label="Ursinho — Pet ${TERMS[mood].toLowerCase()}"`),
    );
  }
});

test("Humor inválido não cai silenciosamente em ok", () => {
  assert.throws(
    () => renderPet("invalido" as unknown as PetMood),
    /Humor do pet inválido/,
  );
});

test("Sprites isolados permanecem decorativos", () => {
  const markup = renderToStaticMarkup(React.createElement(PetHappy));

  assert.ok(markup.includes('aria-hidden="true"'));
  assert.ok(!markup.includes('role="img"'));
  assert.ok(markup.includes('width="180"'));
  assert.ok(markup.includes('shape-rendering="crispEdges"'));
});

test("normalizeSize trata vazio, zero, negativo, NaN e fracionário", () => {
  assert.equal(normalizeSize(undefined), 180);
  assert.equal(normalizeSize(0), 180);
  assert.equal(normalizeSize(-10), 180);
  assert.equal(normalizeSize(Number.NaN), 180);
  assert.equal(normalizeSize(12.4), 12);
  assert.equal(normalizeSize(12.6), 13);
});

test("Animações do pet usam só transform e reduce zera tudo", () => {
  const css = readFileSync(
    resolve(process.cwd(), "src/app/globals.css"),
    "utf8",
  );
  const frames = keyframeBlocks(css);

  assert.deepEqual(
    frames.map((frame) => frame.name),
    ["pet-hop", "pet-sway", "pet-shrink", "pet-blink"],
  );

  for (const frame of frames) {
    const properties = [...frame.body.matchAll(/([a-z-]+)\s*:/g)].map(
      (match) => match[1] ?? "",
    );

    assert.ok(properties.length > 0, `Keyframe sem propriedade: ${frame.name}`);
    assert.ok(
      properties.every((property) => property === "transform"),
      `Keyframe usa propriedade fora de transform: ${frame.name}`,
    );
  }

  const reduce = blockAfter(
    css,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/,
  );

  assert.match(reduce, /animation\s*:\s*none/);
  assert.match(reduce, /transform\s*:\s*none/);
  for (const selector of [".pet", ".pet-feliz", ".pet-ok", ".pet-triste"]) {
    assert.ok(reduce.includes(selector), `Seletor ausente no reduce: ${selector}`);
  }
});
