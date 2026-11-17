import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { handleConnect, GET as connectGet } from "../src/app/api/calendar/connect/route";
import { handleCallback, GET as callbackGet } from "../src/app/api/calendar/callback/route";
import { TEST_USER } from "./helpers";

// Configura variáveis para os testes de rota
process.env.GOOGLE_CLIENT_ID = "mock-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";
process.env.CALENDAR_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.APP_URL = "https://rotina-self.vercel.app";

test("Rota /api/calendar/connect redireciona anônimo para /entrar com Referrer-Policy", async () => {
  const req = new NextRequest("https://qualquer-host.teste/api/calendar/connect");
  const res = await connectGet(req);

  assert.equal(res.status, 307);
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(res.headers.get("Location"), "https://rotina-self.vercel.app/entrar");
});

test("Rota /api/calendar/connect define cookie __Host-gcal_oauth com secure: true sempre, Referrer-Policy e redirect", async () => {
  const req = new NextRequest("https://qualquer-host.teste/api/calendar/connect");
  const res = await handleConnect(req, TEST_USER);

  assert.equal(res.status, 307);
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");

  const location = res.headers.get("Location") ?? "";
  assert.ok(location.startsWith("https://accounts.google.com/o/oauth2/v2/auth"));
  assert.ok(location.includes("redirect_uri=https%3A%2F%2Frotina-self.vercel.app%2Fapi%2Fcalendar%2Fcallback"));

  const cookie = res.cookies.get("__Host-gcal_oauth");
  assert.ok(cookie, "Deve definir o cookie __Host-gcal_oauth");
  assert.equal(cookie.path, "/");
  assert.equal(cookie.sameSite, "lax");
  assert.equal(cookie.httpOnly, true);
  // B1: assert de secure: true SEMPRE (localhost e prod aceitam Secure)
  assert.equal(cookie.secure, true, "Cookie __Host- deve ter secure: true sempre");

  const parsed = JSON.parse(cookie.value);
  assert.ok(parsed.state);
  assert.ok(parsed.codeVerifier);
  assert.equal(parsed.userId, TEST_USER.id);
});

test("Rota /api/calendar/connect e callback sem appUrl respondem com redirect relativo sem host (N3)", async () => {
  const envMap = process.env as Record<string, string | undefined>;
  const oldAppUrl = envMap.APP_URL;
  const oldNodeEnv = envMap.NODE_ENV;
  try {
    delete envMap.APP_URL;
    envMap.NODE_ENV = "production";

    // Connect sem appUrl
    const connectReq = new NextRequest("https://host-externo.teste/api/calendar/connect");
    const connectRes = await handleConnect(connectReq, TEST_USER);
    assert.equal(connectRes.status, 307);
    assert.equal(
      connectRes.headers.get("Location"),
      "/calendario?error=unconfigured",
      "Deve retornar redirect relativo sem host",
    );
    assert.equal(connectRes.headers.get("Referrer-Policy"), "no-referrer");

    // Callback sem appUrl
    const callbackReq = new NextRequest("https://host-externo.teste/api/calendar/callback?code=abc&state=xyz");
    const callbackRes = await handleCallback(callbackReq, TEST_USER);
    assert.equal(callbackRes.status, 307);
    assert.equal(
      callbackRes.headers.get("Location"),
      "/calendario?error=unconfigured",
      "Deve retornar redirect relativo sem host",
    );
  } finally {
    if (oldAppUrl !== undefined) envMap.APP_URL = oldAppUrl;
    else delete envMap.APP_URL;
    if (oldNodeEnv !== undefined) envMap.NODE_ENV = oldNodeEnv;
    else delete envMap.NODE_ENV;
  }
});

test("Rota /api/calendar/callback redireciona anônimo para /entrar com Referrer-Policy", async () => {
  const req = new NextRequest("https://rotina-self.vercel.app/api/calendar/callback?code=abc&state=xyz");
  const res = await callbackGet(req);

  assert.equal(res.status, 307);
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(res.headers.get("Location"), "https://rotina-self.vercel.app/entrar");
});

test("Rota /api/calendar/callback rejeita quando cookie de OAuth está ausente ou expirado", async () => {
  const req = new NextRequest("https://rotina-self.vercel.app/api/calendar/callback?code=abc&state=xyz");
  const res = await handleCallback(req, TEST_USER);

  assert.equal(res.status, 307);
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");

  const location = res.headers.get("Location") ?? "";
  assert.equal(location, "https://rotina-self.vercel.app/calendario?error=missing_params");

  // Garante que o cookie é limpo
  const cookieHeader = res.headers.get("set-cookie") ?? "";
  assert.ok(cookieHeader.includes("__Host-gcal_oauth="));
  assert.ok(cookieHeader.includes("Max-Age=0") || cookieHeader.includes("Expires="));
});

test("Rota /api/calendar/callback rejeita quando state é divergente (M1)", async () => {
  const cookieData = {
    state: "state-original-gerado-no-connect",
    codeVerifier: "code-verifier-secreto-123",
    userId: TEST_USER.id,
  };

  const req = new NextRequest(
    "https://rotina-self.vercel.app/api/calendar/callback?code=abc&state=state-adulterado-pelo-atacante",
    {
      headers: {
        cookie: `__Host-gcal_oauth=${encodeURIComponent(JSON.stringify(cookieData))}`,
      },
    },
  );

  const res = await handleCallback(req, TEST_USER);

  assert.equal(res.status, 307);
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");

  const location = res.headers.get("Location") ?? "";
  assert.equal(location, "https://rotina-self.vercel.app/calendario?error=invalid_state");
});

test("Rota /api/calendar/callback rejeita quando userId do cookie não coincide com o da sessão (B2)", async () => {
  const cookieData = {
    state: "state-valido-12345",
    codeVerifier: "code-verifier-secreto-123",
    userId: "outro-usuario-atacante-uuid",
  };

  const req = new NextRequest(
    "https://rotina-self.vercel.app/api/calendar/callback?code=abc&state=state-valido-12345",
    {
      headers: {
        cookie: `__Host-gcal_oauth=${encodeURIComponent(JSON.stringify(cookieData))}`,
      },
    },
  );

  const res = await handleCallback(req, TEST_USER);

  assert.equal(res.status, 307);
  const location = res.headers.get("Location") ?? "";
  assert.equal(location, "https://rotina-self.vercel.app/calendario?error=user_mismatch");
});
