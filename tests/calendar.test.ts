import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import {
  decryptToken,
  encryptToken,
  getCalendarTokenKey,
  isCalendarCryptoConfigured,
  CryptoError,
} from "../src/lib/calendar/crypto";
import {
  buildGoogleAuthUrl,
  decodeIdToken,
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  GoogleOAuthError,
  refreshGoogleAccessToken,
  revokeGoogleToken,
} from "../src/lib/calendar/oauth";
import {
  deleteCalendarAccount,
  getCalendarFeed,
  listCalendarAccounts,
  saveCalendarAccount,
} from "../src/lib/calendar/store";
import { routeRedirect } from "../src/auth/contracts";
import { isPublicAsset } from "../src/proxy";
import { TEST_USER, withDatabase } from "./helpers";

const USER_A = {
  id: "user-alpha-uuid-111",
  email: "alpha@example.test",
  name: "Usuário Alfa",
};

const USER_B = {
  id: "user-beta-uuid-222",
  email: "beta@example.test",
  name: "Usuário Beta",
};

test("Criptografia AES-256-GCM: round-trip, adulteração e chaves inválidas", () => {
  const validKey = randomBytes(32).toString("base64");
  const keyBuf = getCalendarTokenKey(validKey);
  assert.ok(keyBuf, "Deve carregar chave de 32 bytes válida");
  assert.equal(keyBuf.length, 32);
  assert.equal(isCalendarCryptoConfigured(validKey), true);

  // 1. Chaves inválidas
  assert.equal(getCalendarTokenKey(undefined), null);
  assert.equal(getCalendarTokenKey(""), null);
  assert.equal(getCalendarTokenKey("curta"), null);
  assert.equal(isCalendarCryptoConfigured("curta"), false);

  // 2. Round-trip
  const secretToken = "1//04abcdefGHIJKL-refresh-token-super-secreto-998877";
  const encrypted = encryptToken(secretToken, validKey);
  assert.ok(encrypted.startsWith("v1:"), "Payload encriptado deve começar com v1:");
  const parts = encrypted.split(":");
  assert.equal(parts.length, 4, "Formato v1:iv:tag:cipher deve ter 4 partes separadas por :");

  const decrypted = decryptToken(encrypted, validKey);
  assert.equal(decrypted, secretToken, "Deve recuperar exatamente o token original");

  // 3. Adulteração do ciphertext
  const tamperedCipher = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3].slice(0, -2)}aa`;
  assert.throws(
    () => decryptToken(tamperedCipher, validKey),
    (err: unknown) => {
      assert.ok(err instanceof CryptoError);
      assert.match(err.message, /Falha na autenticação ou decodificação/);
      return true;
    },
  );

  // 4. Adulteração da tag de autenticação
  const tamperedTag = `${parts[0]}:${parts[1]}:00112233445566778899aabbccddeeff:${parts[3]}`;
  assert.throws(
    () => decryptToken(tamperedTag, validKey),
    (err: unknown) => {
      assert.ok(err instanceof CryptoError);
      return true;
    },
  );

  // 5. Adulteração do IV
  const tamperedIv = `${parts[0]}:ffeeddccbbaa998877665544:${parts[2]}:${parts[3]}`;
  assert.throws(
    () => decryptToken(tamperedIv, validKey),
    (err: unknown) => {
      assert.ok(err instanceof CryptoError);
      return true;
    },
  );

  // 6. Payload malformado
  assert.throws(() => decryptToken("invalido", validKey), CryptoError);
  assert.throws(() => decryptToken("v2:1:2:3", validKey), CryptoError);
});

test("OAuth 2.0 PKCE e construção de URL Google", () => {
  const verifier = generateCodeVerifier();
  assert.ok(verifier.length >= 43, "code_verifier deve ter pelo menos 43 caracteres");

  const challenge = generateCodeChallenge(verifier);
  assert.ok(challenge.length > 0, "code_challenge deve ser gerado");
  // Determinístico
  assert.equal(challenge, generateCodeChallenge(verifier));

  const state = generateOAuthState();
  const url = buildGoogleAuthUrl({
    clientId: "test-client-id.apps.googleusercontent.com",
    redirectUri: "http://localhost:3000/api/calendar/callback",
    state,
    codeChallenge: challenge,
  });

  assert.ok(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth"));
  assert.ok(url.includes("access_type=offline"));
  assert.ok(url.includes("code_challenge_method=S256"));
  assert.ok(url.includes(`state=${state}`));
  assert.ok(url.includes("calendar.readonly"));
  assert.ok(url.includes("select_account"));
});

test("Decodificação de ID Token JWT extrai sub e email com segurança", () => {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "google-sub-123456",
      email: "Pessoa.Estudos@Example.Test",
      email_verified: true,
    }),
  ).toString("base64url");
  const fakeJwt = `${header}.${payload}.fakeSignature`;

  const profile = decodeIdToken(fakeJwt);
  assert.equal(profile.sub, "google-sub-123456");
  assert.equal(profile.email, "pessoa.estudos@example.test");

  assert.throws(() => decodeIdToken("invalido"), GoogleOAuthError);
});

test("Troca de código OAuth lida com erros de token e ausência de refresh_token", async () => {
  // Simula resposta de erro do Google
  const mockFetchError = async () =>
    new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });

  await assert.rejects(
    () =>
      exchangeCodeForTokens({
        code: "fake-code",
        codeVerifier: "fake-verifier",
        redirectUri: "http://localhost:3000/api/calendar/callback",
        clientId: "test-id",
        clientSecret: "test-sec",
        fetchFn: mockFetchError as typeof fetch,
      }),
    (err: unknown) => {
      assert.ok(err instanceof GoogleOAuthError);
      assert.match(err.message, /Não foi possível conectar com o Google/);
      return true;
    },
  );

  // Simula resposta sem refresh_token
  const mockFetchNoRefresh = async () =>
    new Response(
      JSON.stringify({
        access_token: "fake-access-token",
        id_token: `${Buffer.from("{}").toString("base64url")}.${Buffer.from(
          JSON.stringify({ sub: "sub1", email: "a@b.com" }),
        ).toString("base64url")}.sig`,
        expires_in: 3600,
      }),
      { status: 200 },
    );

  await assert.rejects(
    () =>
      exchangeCodeForTokens({
        code: "fake-code",
        codeVerifier: "fake-verifier",
        redirectUri: "http://localhost:3000/api/calendar/callback",
        clientId: "test-id",
        clientSecret: "test-sec",
        fetchFn: mockFetchNoRefresh as typeof fetch,
      }),
    (err: unknown) => {
      assert.ok(err instanceof GoogleOAuthError);
      assert.match(err.message, /permissão de atualização offline/);
      return true;
    },
  );
});

test("Isolamento entre usuários: Usuário A não lista nem remove contas de B", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  await withDatabase(async (db) => {
    // 1. Inicialmente ambos não têm contas
    assert.deepEqual(await listCalendarAccounts(db, USER_A), []);
    assert.deepEqual(await listCalendarAccounts(db, USER_B), []);

    // 2. Salva conta para A
    const tokenA = encryptToken("token-a", testKey);
    await saveCalendarAccount(db, USER_A, {
      googleSub: "sub-google-a",
      email: "conta-a@gmail.test",
      refreshTokenEnc: tokenA,
    });

    // 3. Salva conta para B
    const tokenB = encryptToken("token-b", testKey);
    await saveCalendarAccount(db, USER_B, {
      googleSub: "sub-google-b",
      email: "conta-b@gmail.test",
      refreshTokenEnc: tokenB,
    });

    // 4. Listagem isolada
    const contasA = await listCalendarAccounts(db, USER_A);
    const contasB = await listCalendarAccounts(db, USER_B);

    assert.equal(contasA.length, 1);
    assert.equal(contasA[0].email, "conta-a@gmail.test");
    assert.equal(contasB.length, 1);
    assert.equal(contasB[0].email, "conta-b@gmail.test");

    // 5. Tentativa de A remover a conta de B é recusada
    const remocaoInvalida = await deleteCalendarAccount(db, USER_A, contasB[0].id);
    assert.equal(remocaoInvalida, false, "A não pode remover conta de B");

    // A conta de B permanece
    assert.equal((await listCalendarAccounts(db, USER_B)).length, 1);

    // 6. Usuário B remove sua própria conta
    const remocaoValida = await deleteCalendarAccount(db, USER_B, contasB[0].id);
    assert.equal(remocaoValida, true, "B pode remover sua própria conta");
    assert.equal((await listCalendarAccounts(db, USER_B)).length, 0);

    // A conta de A permanece intacta
    assert.equal((await listCalendarAccounts(db, USER_A)).length, 1);
  });
});

test("Falha invalid_grant em uma conta é isolada e não derruba outras contas conectadas", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userResiliente = {
    id: `user-resiliente-${randomBytes(8).toString("hex")}`,
    email: "resiliente@example.test",
    name: "Usuário Resiliente",
  };

  await withDatabase(async (db) => {
    // Conecta duas contas para o mesmo usuário
    await saveCalendarAccount(db, userResiliente, {
      googleSub: "sub-conta-1-revogada",
      email: "expirada@trabalho.test",
      refreshTokenEnc: encryptToken("token-revogado", testKey),
    });

    await saveCalendarAccount(db, userResiliente, {
      googleSub: "sub-conta-2-valida",
      email: "ativa@estudos.test",
      refreshTokenEnc: encryptToken("token-valido", testKey),
    });

    const contas = await listCalendarAccounts(db, userResiliente);
    assert.equal(contas.length, 2);

    // Mock do fetch:
    // - Para a conta 1 (token-revogado): retorna 400 invalid_grant na renovação de token
    // - Para a conta 2 (token-valido): retorna 200 com access_token, e na busca de eventos retorna lista com 1 evento
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);

      if (urlStr.includes("oauth2.googleapis.com/token")) {
        const bodyStr = String(init?.body ?? "");
        if (bodyStr.includes("token-revogado")) {
          return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
        }
        return new Response(JSON.stringify({ access_token: "access-token-conta-2" }), { status: 200 });
      }

      if (urlStr.includes("calendars/primary/events")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "ev-1",
                summary: "Reunião de Alinhamento",
                start: { dateTime: "2026-11-17T14:00:00-03:00" },
                end: { dateTime: "2026-11-17T15:00:00-03:00" },
                htmlLink: "https://calendar.google.com/event?eid=123",
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response("Not found", { status: 404 });
    };

    const feed = await getCalendarFeed(db, userResiliente, new Date("2026-11-17T12:00:00-03:00"), mockFetch as typeof fetch);

    assert.equal(feed.isConfigured, true);
    assert.equal(feed.accounts.length, 2);

    // A conta 1 possui aviso de erro isolado
    const contaRevogada = contas.find((c) => c.email === "expirada@trabalho.test")!;
    assert.ok(feed.accountErrors[contaRevogada.id]);
    assert.match(feed.accountErrors[contaRevogada.id], /Autorização expirada ou revogada/);

    // A conta 2 carregou seu evento com sucesso
    assert.equal(feed.events.length, 1);
    assert.equal(feed.events[0].title, "Reunião de Alinhamento");
    assert.equal(feed.events[0].accountEmail, "ativa@estudos.test");
  });
});

test("Proteção de rota: /calendario e endpoints do calendário exigem autenticação", () => {
  // Anônimo é redirecionado para /entrar
  assert.equal(routeRedirect("/calendario", null), "/entrar");
  assert.equal(routeRedirect("/calendario/", null), "/entrar");

  // Usuário autenticado acessa normalmente
  assert.equal(routeRedirect("/calendario", TEST_USER), null);

  // Não são assets públicos
  assert.equal(isPublicAsset("/calendario"), false);
  assert.equal(isPublicAsset("/api/calendar/connect"), false);
  assert.equal(isPublicAsset("/api/calendar/callback"), false);
});
