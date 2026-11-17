import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PET_CATALOG,
  PET_KINDS,
  DEFAULT_PET_KIND,
  isPetKind,
  parsePetKind,
  type PetKind,
} from "../src/lib/pets";
import { PetSprite, SPRITES } from "../src/app/pet-sprites";
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

test("Catálogo de pets contém 6 companheiros e cada um possui 3 humores com SVG 16x16 válido", () => {
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
    assert.ok(def.name.length > 0, `Companheiro ${kind} deve ter nome pt-BR`);
    assert.ok(def.description.length > 0, `Companheiro ${kind} deve ter descrição`);

    const spriteDef = SPRITES[kind];
    assert.ok(spriteDef, `Companheiro ${kind} deve ter SPRITES definido`);
    assert.equal(spriteDef.rows.length, 16, `Companheiro ${kind} deve ter 16 linhas`);
    for (const row of spriteDef.rows) {
      assert.equal(row.length, 16, `Companheiro ${kind} deve ter 16 colunas`);
    }

    for (const mood of moods) {
      const face = spriteDef.faces[mood];
      assert.ok(face, `Companheiro ${kind} deve ter rosto para o humor ${mood}`);
      assert.ok(face.eyes.length > 0, `Companheiro ${kind} deve ter olhos para ${mood}`);
      assert.ok(face.mouth.length > 0, `Companheiro ${kind} deve ter boca para ${mood}`);

      const html = renderToStaticMarkup(
        React.createElement(PetSprite, {
          kind,
          mood,
          size: 64,
          label: `${def.name} ${mood}`,
        }),
      );

      assert.ok(html.startsWith("<svg"), `Deve gerar elemento <svg> para ${kind} ${mood}`);
      assert.ok(html.includes('viewBox="0 0 16 16"'), "Deve manter viewBox 16x16");
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
    assert.ok(htmlFeliz.includes('aria-label="Pet feliz"'));

    const htmlOk = renderToStaticMarkup(
      React.createElement(Pet, { mood: "ok", kind }),
    );
    assert.ok(htmlOk.includes('class="pet pet-ok"'));
    assert.ok(htmlOk.includes('aria-label="Pet de boa"'));

    const htmlTriste = renderToStaticMarkup(
      React.createElement(Pet, { mood: "triste", kind }),
    );
    assert.ok(htmlTriste.includes('class="pet pet-triste"'));
    assert.ok(htmlTriste.includes('aria-label="Pet triste"'));
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

  // Calendário desabilitado
  assert.ok(html.includes('aria-disabled="true"'), "Calendário deve ter aria-disabled='true'");
  assert.ok(html.includes("Em breve"), "Calendário deve ter indicador 'Em breve'");

  // Menu do usuário
  assert.ok(html.includes("usuario@teste.com"), "Deve exibir o e-mail do usuário");
  assert.ok(html.includes('class="logout"'), "Deve conter botão Sair");

  // Barra móvel inferior
  assert.ok(html.includes('class="mobile-tab-bar"'), "Deve conter mobile-tab-bar");
  assert.ok(html.includes('aria-label="Navegação rápida"'), "Barra móvel deve ter aria-label");
});
