import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DICT,
  getDictionary,
  getPetCopy,
  localizeErrorMessage,
  parseLocale,
} from "../src/lib/i18n";
import { PET_KINDS } from "../src/lib/pets";
import {
  completionMessage,
  scheduleSummary,
  skipMessage,
} from "../src/lib/rules";
import { WelcomePage } from "../src/app/welcome-page";
import { WelcomeDemo } from "../src/app/welcome-demo";
import { AuthPage } from "../src/app/auth-page";
import { AuthForm } from "../src/app/auth-form";
import { Header } from "../src/app/header";
import { Pet } from "../src/app/pet";
import { ActivityRecurrence } from "../src/app/activity-recurrence";
import { LanguageSwitcher } from "../src/app/language-switcher";

test("parseLocale aceita somente pt ou en e cai com segurança em pt", () => {
  assert.equal(parseLocale("pt"), "pt");
  assert.equal(parseLocale("en"), "en");
  for (const invalid of ["es", "fr", "", null, undefined, 123, {}, "__proto__"]) {
    assert.equal(parseLocale(invalid), "pt");
  }
});

test("dicionários pt e en possuem estrutura equivalente e todos os 12 pets traduzidos", () => {
  assert.deepEqual(Object.keys(DICT.pt).sort(), Object.keys(DICT.en).sort());
  for (const section of Object.keys(DICT.pt) as Array<keyof typeof DICT.pt>) {
    assert.deepEqual(
      Object.keys(DICT.pt[section]).sort(),
      Object.keys(DICT.en[section]).sort(),
      `Seção divergente em i18n: ${section}`,
    );
  }
  for (const kind of PET_KINDS) {
    const pt = getPetCopy(kind, "pt");
    const en = getPetCopy(kind, "en");
    assert.ok(pt.name.length > 0 && pt.description.length > 0);
    assert.ok(en.name.length > 0 && en.description.length > 0);
  }
});

test("WelcomePage apresenta o site antes do login em português e inglês com CTAs e seletor de idioma", () => {
  const ptHtml = renderToStaticMarkup(
    React.createElement(WelcomePage, { locale: "pt" }),
  );
  assert.ok(ptHtml.includes('href="/criar-conta"'));
  assert.ok(ptHtml.includes('href="/entrar"'));
  assert.ok(ptHtml.includes("Seus hábitos diários, com um companheiro que sente cada passo."));
  assert.ok(ptHtml.includes("12 companheiros originais"));
  assert.ok(ptHtml.includes("Google Calendar"));
  assert.ok(ptHtml.includes('value="pt"'));
  assert.ok(ptHtml.includes('value="en"'));
  assert.ok(ptHtml.includes('aria-pressed="true"'));

  const enHtml = renderToStaticMarkup(
    React.createElement(WelcomePage, { locale: "en" }),
  );
  assert.ok(enHtml.includes('href="/criar-conta"'));
  assert.ok(enHtml.includes('href="/entrar"'));
  assert.ok(enHtml.includes("Your daily habits, with a companion that feels every step."));
  assert.ok(enHtml.includes("12 original companions"));
  assert.ok(enHtml.includes("Create my free account"));
  assert.ok(enHtml.includes("Sign in"));
});

test("WelcomeDemo renderiza prévia interativa com pets selecionáveis e tarefas clicáveis", () => {
  const html = renderToStaticMarkup(
    React.createElement(WelcomeDemo, { locale: "en" }),
  );
  assert.ok(html.includes("Try it now · Interactive preview"));
  assert.ok(html.includes("Bear Cub"));
  assert.ok(html.includes("Little Dragon"));
  assert.ok(html.includes("+20"));
  assert.ok(html.includes("67%"));
});

test("AuthPage, AuthForm, Header, Pet e ActivityRecurrence suportam inglês e português", () => {
  const authEn = renderToStaticMarkup(
    React.createElement(AuthPage, { signup: true, locale: "en" }),
  );
  assert.ok(authEn.includes("Your first step."));
  assert.ok(authEn.includes("Show password"));
  assert.ok(authEn.includes("Explore Rotina Pet"));
  assert.ok(authEn.includes('href="/"'));

  const formEn = renderToStaticMarkup(
    React.createElement(AuthForm, { signup: false, locale: "en" }),
  );
  assert.ok(formEn.includes("Sign in"));
  assert.ok(formEn.includes("Password"));

  const headerEn = renderToStaticMarkup(
    React.createElement(Header, {
      active: "hoje",
      user: { email: "user@example.test" },
      mood: "feliz",
      locale: "en",
    }),
  );
  assert.ok(headerEn.includes(">Today<"));
  assert.ok(headerEn.includes(">Routines<"));
  assert.ok(headerEn.includes(">Calendar<"));
  assert.ok(headerEn.includes(">Sign out<"));

  const petEn = renderToStaticMarkup(
    React.createElement(Pet, { mood: "feliz", kind: "gato", locale: "en" }),
  );
  assert.ok(petEn.includes('aria-label="Little Cat — Happy pet"'));

  const recEn = renderToStaticMarkup(
    React.createElement(ActivityRecurrence, {
      prefix: "en-test",
      routineWeekdays: 62,
      schedule: { weekdays: null, onceDate: null },
      today: "2026-11-26",
      locale: "en",
    }),
  );
  assert.ok(recEn.includes("<legend>Repeat</legend>"));
  assert.ok(recEn.includes("Routine days: Weekdays."));
  assert.ok(recEn.includes("Follow routine"));
});

test("LanguageSwitcher marca idioma ativo com aria-pressed e texto acessível", () => {
  const pt = renderToStaticMarkup(
    React.createElement(LanguageSwitcher, { locale: "pt" }),
  );
  assert.match(pt, /value="pt"[^>]*aria-pressed="true"/);
  assert.match(pt, /value="en"[^>]*aria-pressed="false"/);
  assert.ok(pt.includes("Português"));
  assert.ok(pt.includes("English"));
});

test("regras e erros traduzem corretamente para inglês mantendo fallback seguro", () => {
  assert.equal(scheduleSummary({ weekdays: null, onceDate: null }, 127, "en"), "Every day");
  assert.equal(scheduleSummary({ weekdays: 62, onceDate: null }, 1, "en"), "Weekdays");
  assert.equal(scheduleSummary({ weekdays: 65, onceDate: null }, 1, "en"), "Weekend");
  assert.equal(scheduleSummary({ weekdays: null, onceDate: "2026-11-20" }, 1, "en"), "Only 11/20");
  assert.match(completionMessage(true, "en"), /Completion recorded/);
  assert.match(skipMessage(true, "en"), /Activity skipped/);
  assert.equal(
    localizeErrorMessage("Informe um e-mail válido.", "en"),
    "Please enter a valid email address.",
  );
  assert.equal(
    localizeErrorMessage("Mensagem desconhecida", "en"),
    "Mensagem desconhecida",
  );
  assert.ok(getDictionary("en").welcome.heroCtaPrimary.length > 0);
});
