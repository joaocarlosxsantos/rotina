import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Pet } from "../src/app/pet";
import { PetHappy, PetOk, PetSad } from "../src/app/pet-sprites";

type Mood = "feliz" | "ok" | "triste";

const CASES = [
  { mood: "feliz", Sprite: PetHappy, label: "Pet feliz" },
  { mood: "ok", Sprite: PetOk, label: "Pet ok" },
  { mood: "triste", Sprite: PetSad, label: "Pet triste" },
] as const;

function renderPet(mood: Mood): string {
  return renderToStaticMarkup(React.createElement(Pet, { mood }));
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

test("Sprites isolados permanecem decorativos", () => {
  const markup = renderToStaticMarkup(React.createElement(PetHappy));

  assert.ok(markup.includes('aria-hidden="true"'));
  assert.ok(!markup.includes('role="img"'));
  assert.ok(markup.includes('width="180"'));
  assert.ok(markup.includes('shape-rendering="crispEdges"'));
});
