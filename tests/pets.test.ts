import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PET_CATALOG,
  PET_KINDS,
  DEFAULT_PET_KIND,
  isPetKind,
  parsePetKind,
  type PetKind,
} from "../src/lib/pets";
import { PetSprite, SPRITES, horizontalRuns } from "../src/app/pet-sprites";
import { Pet } from "../src/app/pet";
import { Header } from "../src/app/header";
import { getUserPet, setUserPet, dashboard } from "../src/lib/store";
import { routeRedirect } from "../src/auth/contracts";
import { isPublicAsset } from "../src/proxy";
import { TEST_USER, withDatabase } from "./helpers";
import { InputError } from "../src/lib/rules";

const OTHER_USER = {
  id: "user-b-test-uuid-456",
  email: "user-b@example.test",
  name: "Usuário B",
};

test("contact sheet contém os 18 sprites nos dois tamanhos e dois fundos, sem rede ou scripts", () => {
  const preview = readFileSync("docs/pets-preview.html", "utf8");
  assert.equal((preview.match(/role="img"/g) ?? []).length, 72);
  assert.equal((preview.match(/width="64"/g) ?? []).length, 36);
  assert.equal((preview.match(/width="128"/g) ?? []).length, 36);
  assert.equal((preview.match(/class="board light"/g) ?? []).length, 6);
  assert.equal((preview.match(/class="board dark"/g) ?? []).length, 6);
  assert.doesNotMatch(preview, /<script|https?:\/\//);
  assert.ok(preview.includes('id="animate"'));
  assert.ok(preview.includes("prefers-reduced-motion: reduce"));
  for (const kind of PET_KINDS) for (const mood of ["sad", "ok", "happy"] as const) {
    assert.ok(preview.includes(renderToStaticMarkup(React.createElement(PetSprite, { kind, mood, size: 64, label: `${PET_CATALOG[kind].name} ${{ sad: "triste", ok: "de boa", happy: "feliz" }[mood]}` }))));
  }
});

test("Catálogo de pets contém 6 companheiros e cada um possui 3 humores com SVG 32x32 válido", () => {
  assert.equal(PET_KINDS.length, 6, "Devem existir exatamente 6 companheiros no catálogo");
  assert.deepEqual(
    PET_KINDS,
    ["original", "gato", "cachorro", "coelho", "dragao", "planta"],
  );

  const moods = ["sad", "ok", "happy"] as const;

  for (const kind of PET_KINDS) {
    const def = PET_CATALOG[kind];
    assert.ok(def, `Companheiro ${kind} deve ter definição`);
    assert.equal(def.id, kind);
    assert.equal(def.name, ["Ursinho", "Gatinho", "Cachorrinho", "Coelhinho", "Dragãozinho", "Brotinho"][PET_KINDS.indexOf(kind)]);
    assert.ok(def.name.length > 0, `Companheiro ${kind} deve ter nome pt-BR`);
    assert.ok(def.description.length > 0, `Companheiro ${kind} deve ter descrição`);

    const spriteDef = SPRITES[kind];
    assert.ok(spriteDef, `Companheiro ${kind} deve ter SPRITES definido`);
    assert.deepEqual(Object.keys(spriteDef.rows), ["sad", "ok", "happy"]);
    for (const palette of [spriteDef.colors, spriteDef.sadColors]) {
      assert.ok(Object.keys(palette).length >= 6 && Object.keys(palette).length <= 10);
      assert.ok(Object.values(palette).every(color => /^#[0-9a-f]{6}$/i.test(color) && color !== "#000000"));
    }
    assert.notDeepEqual(spriteDef.colors, spriteDef.sadColors);
    assert.equal(new Set(moods.map(mood => spriteDef.rows[mood].join("\n"))).size, 3);
    for (const mood of moods) {
      const rows = spriteDef.rows[mood];
      assert.equal(rows.length, 32);
      assert.ok(rows.every(row => row.length === 32));
      assert.ok([...rows.join("")].every(cell => cell === "." || cell in spriteDef.colors));
      assert.ok(rows.some(row => row.includes("o")), "Contorno presente");
      assert.ok(rows.some(row => row.includes("e")), "Olhos presentes");
      assert.ok(rows.some(row => row.includes("h")), "Brilho dos olhos presente");
      if (mood === "sad") assert.ok(rows.some(row => row.includes("t")), "Lágrimas presentes");
      const runs = horizontalRuns(rows);
      const pixels = rows.join("").replaceAll(".", "").length;
      assert.ok(runs.length < pixels, "Corridas devem reduzir os rects");
      assert.equal(runs.reduce((sum, run) => sum + run.width, 0), pixels);
      const reconstructed = Array.from({ length: 32 }, () => Array<string>(32).fill("."));
      for (const run of runs) {
        assert.ok(run.width > 0 && run.x + run.width <= 32);
        for (let x = run.x; x < run.x + run.width; x++) reconstructed[run.y][x] = run.key;
        assert.notEqual(rows[run.y][run.x + run.width], run.key, "Corrida deve ser máxima");
      }
      assert.deepEqual(reconstructed.map(row => row.join("")), rows, "Compressão deve preservar cada pixel");
      const html = renderToStaticMarkup(
        React.createElement(PetSprite, {
          kind,
          mood,
          size: 64,
          label: `${def.name} ${mood}`,
        }),
      );

      assert.ok(html.startsWith("<svg"), `Deve gerar elemento <svg> para ${kind} ${mood}`);
      assert.ok(html.includes('viewBox="0 0 32 32"'), "Deve manter viewBox 32x32");
      assert.ok(html.includes('shape-rendering="crispEdges"'), "Deve preservar crispEdges");
      assert.ok(html.includes('role="img"'), "Deve ter role img");
      assert.ok(html.includes(`aria-label="${def.name} ${mood}"`), "Deve ter aria-label acessível");
    }
  }
});

test("Pet renderiza com o companheiro escolhido preservando o humor", () => {
  for (const kind of PET_KINDS) {
    const htmlFeliz = renderToStaticMarkup(
      React.createElement(Pet, { mood: "feliz", kind }),
    );
    assert.ok(htmlFeliz.includes('class="pet pet-feliz"'));
    assert.ok(htmlFeliz.includes(`aria-label="${PET_CATALOG[kind].name} — Pet feliz"`));

    const htmlOk = renderToStaticMarkup(
      React.createElement(Pet, { mood: "ok", kind }),
    );
    assert.ok(htmlOk.includes('class="pet pet-ok"'));
    assert.ok(htmlOk.includes(`aria-label="${PET_CATALOG[kind].name} — Pet de boa"`));

    const htmlTriste = renderToStaticMarkup(
      React.createElement(Pet, { mood: "triste", kind }),
    );
    assert.ok(htmlTriste.includes('class="pet pet-triste"'));
    assert.ok(htmlTriste.includes(`aria-label="${PET_CATALOG[kind].name} — Pet triste"`));
  }
});

test("Validação de pet_kind aceita catálogo e rejeita valores inválidos", () => {
  for (const valid of PET_KINDS) {
    assert.equal(isPetKind(valid), true);
    assert.equal(parsePetKind(valid), valid);
  }

  const invalids = ["alien", "urso", "peixe", "", "   ", null, undefined, 42, {}];
  for (const invalid of invalids) {
    assert.equal(isPetKind(invalid), false);
    assert.equal(parsePetKind(invalid), DEFAULT_PET_KIND);
  }
});

test("Persistência e isolamento entre usuários para seleção do pet", async () => {
  await withDatabase(async (db) => {
    // 1. Usuário sem registro anterior recebe o pet padrão (original)
    const petInicialA = await getUserPet(db, TEST_USER);
    const petInicialB = await getUserPet(db, OTHER_USER);
    assert.equal(petInicialA, DEFAULT_PET_KIND);
    assert.equal(petInicialB, DEFAULT_PET_KIND);

    // 2. Rejeição no servidor para pet inválido
    await assert.rejects(
      () => setUserPet(db, TEST_USER, "invalido"),
      (err: unknown) => {
        assert.ok(err instanceof InputError);
        assert.match(err.message, /Pet inválido/);
        return true;
      },
    );

    // 3. Usuário A escolhe gato
    const escolhaA = await setUserPet(db, TEST_USER, "gato");
    assert.equal(escolhaA, "gato");

    // 4. Isolamento: escolha de A não altera B
    assert.equal(await getUserPet(db, TEST_USER), "gato");
    assert.equal(await getUserPet(db, OTHER_USER), DEFAULT_PET_KIND);

    // 5. Usuário B escolhe dragão
    const escolhaB = await setUserPet(db, OTHER_USER, "dragao");
    assert.equal(escolhaB, "dragao");

    // 6. Ambos persistem independentemente
    assert.equal(await getUserPet(db, TEST_USER), "gato");
    assert.equal(await getUserPet(db, OTHER_USER), "dragao");

    // 7. Atualização idempotente: A troca para planta
    await setUserPet(db, TEST_USER, "planta");
    assert.equal(await getUserPet(db, TEST_USER), "planta");
    assert.equal(await getUserPet(db, OTHER_USER), "dragao");

    // 8. O dashboard do usuário reflete o pet escolhido
    const dashA = await dashboard(db, TEST_USER, new Date());
    assert.equal(dashA.petKind, "planta");

    const dashB = await dashboard(db, OTHER_USER, new Date());
    assert.equal(dashB.petKind, "dragao");
  });
});

test("Rota /pets é protegida contra acesso não autenticado", () => {
  // Anônimo deve ser redirecionado para /entrar
  assert.equal(routeRedirect("/pets", null), "/entrar");
  assert.equal(routeRedirect("/pets/", null), "/entrar");

  // Usuário autenticado tem acesso liberado
  assert.equal(routeRedirect("/pets", TEST_USER), null);

  // /pets não é asset público
  assert.equal(isPublicAsset("/pets"), false);
});

test("Header renderiza navegação responsiva, marca item ativo e exibe menu do usuário", () => {
  const html = renderToStaticMarkup(
    React.createElement(Header, {
      active: "pets",
      user: { email: "usuario@teste.com" },
      mood: "feliz",
    }),
  );

  // Topbar
  assert.ok(html.includes('class="topbar app-topbar"'), "Deve conter a topbar com classe app-topbar");
  assert.ok(html.includes('aria-label="Rotina Pet"'), "Logo da marca com aria-label");

  // Links do desktop nav
  assert.ok(html.includes('href="/pets"'), "Deve conter link para /pets");
  assert.ok(html.includes('href="/rotinas"'), "Deve conter link para /rotinas");
  assert.ok(html.includes('href="/"'), "Deve conter link para /");

  // Item ativo
  assert.ok(html.includes('href="/pets"'), "Deve conter link de Pets");
  assert.ok(html.includes('aria-current="page"'), "Link ativo deve conter aria-current='page'");

  // Link Calendário habilitado
  assert.ok(html.includes('href="/calendario"'), "Deve conter link para /calendario");

  // Menu do usuário
  assert.ok(html.includes("usuario@teste.com"), "Deve exibir o e-mail do usuário");
  assert.ok(html.includes('class="logout"'), "Deve conter botão Sair");

  // Barra móvel inferior
  assert.ok(html.includes('class="mobile-tab-bar"'), "Deve conter mobile-tab-bar");
  assert.ok(html.includes('aria-label="Navegação rápida"'), "Barra móvel deve ter aria-label");
});
