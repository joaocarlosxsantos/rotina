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
} from "../src/lib/pets";
import { PetSprite, SPRITES, normalizeSize } from "../src/app/pet-sprites";
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

test("Contact sheet has all 36 vector sprites in two sizes and backgrounds", () => {
  const preview = readFileSync("docs/pets-preview.html", "utf8");
  assert.equal((preview.match(/role="img"/g) ?? []).length, 144);
  for (const size of [64, 128]) assert.equal((preview.match(new RegExp('width="' + size + '"', "g")) ?? []).length, 72);
  for (const theme of ["light", "dark"]) assert.equal((preview.match(new RegExp('class="board ' + theme + '"', "g")) ?? []).length, 12);
  assert.doesNotMatch(preview, /<script|https?:\/\/|pixelated|crispEdges/);
  assert.ok(preview.includes("prefers-reduced-motion: reduce"));
  assert.ok(preview.includes('id="animate"'));
  for (const kind of PET_KINDS) for (const mood of ["sad", "ok", "happy"]) {
    assert.ok(preview.includes('data-pet-kind="' + kind + '" data-pet-mood="' + mood + '"'));
  }
});

test("All 12 kinds have distinct vector illustrations for all 3 moods", () => {
  assert.deepEqual(PET_KINDS, ["original", "gato", "cachorro", "coelho", "dragao", "planta", "hamster", "raposa", "panda", "pinguim", "pintinho", "coruja"]);
  const silhouettes = new Set<string>();
  for (const kind of PET_KINDS) {
    assert.equal(PET_CATALOG[kind].id, kind);
    assert.ok(PET_CATALOG[kind].description.length > 0);
    assert.ok(SPRITES[kind]);
    const variants = new Set<string>();
    for (const mood of ["sad", "ok", "happy"] as const) {
      const label = PET_CATALOG[kind].name + " " + mood;
      const html = renderToStaticMarkup(React.createElement(PetSprite, { kind, mood, size: 64, className: "sample", label }));
      assert.ok(html.startsWith("<svg"));
      assert.ok(html.includes('viewBox="0 0 200 200"'));
      assert.ok(html.includes('width="64" height="64"'));
      assert.ok(html.includes('class="sample"'));
      assert.ok(html.includes('role="img"'));
      assert.ok(html.includes('aria-label="' + label + '"'));
      assert.ok(html.includes("<title>" + label + "</title>"));
      assert.ok(html.includes("<linearGradient"));
      assert.ok(html.includes('class="pet-eyes"'));
      assert.doesNotMatch(html, /<rect|crispEdges|pixelated/);
      variants.add(html.replace(/data-pet-mood="[^"]*"/, ""));
      if (mood === "ok") silhouettes.add(html.replace(/data-pet-kind="[^"]*"|aria-label="[^"]*"|<title>.*?<\/title>/g, ""));
    }
    assert.equal(variants.size, 3);
    const defaultLabel = renderToStaticMarkup(React.createElement(PetSprite, {kind, mood: "ok"}));
    assert.ok(defaultLabel.includes('role="img"'));
    assert.ok(defaultLabel.includes(PET_CATALOG[kind].name));
  }
  assert.equal(silhouettes.size, 12);
});

test("Decorative sprites suppress image semantics even with an explicit label", () => {
  for (const kind of PET_KINDS) for (const mood of ["sad", "ok", "happy"] as const) {
    const html = renderToStaticMarkup(React.createElement(PetSprite, { kind, mood, decorative: true, label: "Repeated visible text" }));
    assert.ok(html.includes('aria-hidden="true"'));
    assert.ok(html.includes('focusable="false"'));
    assert.ok(html.includes("<path"));
    assert.doesNotMatch(html, /role=|aria-label=|<title/);
  }
});

test("Vector gradient ids do not collide when the same pet repeats", () => {
  const html = renderToStaticMarkup(React.createElement("div", null, ...[1,2,3].map(key => React.createElement(PetSprite, { key, kind: "panda", mood: "ok" }))));
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, ref] of html.matchAll(/url\(#([^)]*)\)/g)) assert.ok(ids.includes(ref));
});

test("Sprite dimensions normalize invalid input", () => {
  for (const size of [undefined, NaN, Infinity, -1, 0]) assert.equal(normalizeSize(size), 180);
  assert.equal(normalizeSize(0.2), 1);
  assert.equal(normalizeSize(63.7), 64);
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

  const invalids = ["alien", "urso", "peixe", "", "   ", null, undefined, 42, {}, "__proto__", "constructor", "GATO", "gato ", "<script>", "panda' OR 1=1"];
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

test("Every new animal persists through the strict server allowlist", async () => {
  await withDatabase(async db => {
    for (const kind of PET_KINDS.slice(6)) {
      assert.equal(parsePetKind(kind), kind);
      assert.equal(await setUserPet(db, TEST_USER, kind), kind);
      assert.equal(await getUserPet(db, TEST_USER), kind);
    }
    for (const invalid of ["__proto__", "constructor", "PANDA", "panda ", "panda' OR 1=1", null, {}]) {
      await assert.rejects(() => setUserPet(db, TEST_USER, invalid), InputError);
    }
    assert.equal(await getUserPet(db, TEST_USER), "coruja");
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
