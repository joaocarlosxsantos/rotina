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
import { getCalendarConfig, getRedirectUri } from "../src/lib/calendar/config";
import {
  buildGoogleAuthUrl,
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  GoogleEmailUnverifiedError,
  GoogleNoOfflineAccessError,
  GoogleOAuthError,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  timingSafeStringEqual,
} from "../src/lib/calendar/oauth";
import {
  CalendarAccountLimitError,
  deleteCalendarAccount,
  getCalendarFeed,
  isValidCalendarHtmlLink,
  listCalendarAccounts,
  saveCalendarAccount,
} from "../src/lib/calendar/store";
import { CALENDAR_ERROR_MESSAGES, CALENDAR_SUCCESS_MESSAGES } from "../src/app/calendario/page";
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

test("Criptografia AES-256-GCM com AAD: integridade vinculada a user_id e google_sub (I1)", () => {
  const validKey = randomBytes(32).toString("base64");
  const secretToken = "refresh-token-super-secreto";
  const aadA = "user-123:sub-google-456";
  const aadB = "user-999:sub-google-456"; // Outro usuário

  const encrypted = encryptToken(secretToken, validKey, aadA);

  // Decriptação com o mesmo AAD deve ter sucesso
  const decrypted = decryptToken(encrypted, validKey, aadA);
  assert.equal(decrypted, secretToken);

  // Decriptação com AAD diferente (ex: ataque de troca de registro entre usuários) deve falhar
  assert.throws(
    () => decryptToken(encrypted, validKey, aadB),
    (err: unknown) => {
      assert.ok(err instanceof CryptoError);
      assert.match(err.message, /Falha na autenticação/);
      return true;
    },
  );

  // Decriptação sem AAD quando foi encriptado com AAD deve falhar
  assert.throws(
    () => decryptToken(encrypted, validKey),
    (err: unknown) => {
      assert.ok(err instanceof CryptoError);
      return true;
    },
  );
});

test("Comparação de state resistente a timing attacks (M1)", () => {
  const state = "abcdef1234567890abcdef1234567890";
  const identical = "abcdef1234567890abcdef1234567890";
  const differentContent = "abcdef1234567890abcdef1234567891";
  const differentLength = "abcdef1234567890";

  assert.equal(timingSafeStringEqual(state, identical), true);
  assert.equal(timingSafeStringEqual(state, differentContent), false);
  assert.equal(timingSafeStringEqual(state, differentLength), false);
  assert.equal(timingSafeStringEqual(state, "" as unknown as string), false);
});

test("Configuração do Calendar e validação de APP_URL em produção (M2)", () => {
  const testKey = randomBytes(32).toString("base64");

  // 1. Em desenvolvimento: fallback seguro para localhost
  const devConfig = getCalendarConfig({
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    CALENDAR_TOKEN_KEY: testKey,
    NODE_ENV: "development",
  });
  assert.equal(devConfig.isAvailable, true);
  assert.equal(devConfig.appUrl, "http://localhost:3000");

  // 2. Em produção sem APP_URL: não cai em localhost e fica indisponível
  const prodWithoutAppUrl = getCalendarConfig({
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    CALENDAR_TOKEN_KEY: testKey,
    NODE_ENV: "production",
  });
  assert.equal(prodWithoutAppUrl.isAvailable, false);
  assert.equal(prodWithoutAppUrl.appUrl, "");

  // 3. Em produção com APP_URL explícita: disponível e usa a APP_URL
  const prodWithAppUrl = getCalendarConfig({
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    CALENDAR_TOKEN_KEY: testKey,
    APP_URL: "https://rotina-self.vercel.app",
    NODE_ENV: "production",
  });
  assert.equal(prodWithAppUrl.isAvailable, true);
  assert.equal(prodWithAppUrl.appUrl, "https://rotina-self.vercel.app");

  // 4. Em produção com VERCEL_PROJECT_PRODUCTION_URL: disponível
  const prodWithVercelUrl = getCalendarConfig({
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    CALENDAR_TOKEN_KEY: testKey,
    VERCEL_PROJECT_PRODUCTION_URL: "rotina-self.vercel.app",
    NODE_ENV: "production",
  });
  assert.equal(prodWithVercelUrl.isAvailable, true);
  assert.equal(prodWithVercelUrl.appUrl, "https://rotina-self.vercel.app");

  // 5. getRedirectUri usa a appUrl da configuração (sem parâmetro origin)
  const redirectUri = getRedirectUri({
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    CALENDAR_TOKEN_KEY: testKey,
    APP_URL: "https://rotina-self.vercel.app",
  });
  assert.equal(redirectUri, "https://rotina-self.vercel.app/api/calendar/callback");
});

test("OAuth 2.0 PKCE e construção de URL Google", () => {
  const verifier = generateCodeVerifier();
  assert.ok(verifier.length >= 43, "code_verifier deve ter pelo menos 43 caracteres");

  const challenge = generateCodeChallenge(verifier);
  assert.ok(challenge.length > 0, "code_challenge deve ser gerado");
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

test("Troca de código OAuth valida dados via endpoint userinfo oficial e exige email_verified (M3)", async () => {
  // 1. Sucesso: token retornado e userinfo com email verificado
  const mockFetchSuccess = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(input);

    if (urlStr.includes("oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({
          access_token: "mock-valid-access-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    }

    if (urlStr.includes("openidconnect.googleapis.com/v1/userinfo")) {
      const authHeader = (init?.headers as Record<string, string>)?.Authorization;
      assert.equal(authHeader, "Bearer mock-valid-access-token");
      return new Response(
        JSON.stringify({
          sub: "google-sub-valid-987",
          email: "Usuario.Verificado@Example.Test",
          email_verified: true,
        }),
        { status: 200 },
      );
    }

    return new Response("Not found", { status: 404 });
  };

  const { tokens, profile } = await exchangeCodeForTokens({
    code: "fake-code",
    codeVerifier: "fake-verifier",
    redirectUri: "http://localhost:3000/api/calendar/callback",
    clientId: "test-id",
    clientSecret: "test-sec",
    fetchFn: mockFetchSuccess as typeof fetch,
  });

  assert.equal(tokens.accessToken, "mock-valid-access-token");
  assert.equal(tokens.refreshToken, "mock-refresh-token");
  assert.equal(profile.sub, "google-sub-valid-987");
  assert.equal(profile.email, "usuario.verificado@example.test");

  // 2. Rejeição quando email_verified é falso
  const mockFetchUnverified = async (input: RequestInfo | URL) => {
    const urlStr = String(input);
    if (urlStr.includes("oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({
          access_token: "mock-unverified-access-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    }
    if (urlStr.includes("openidconnect.googleapis.com/v1/userinfo")) {
      return new Response(
        JSON.stringify({
          sub: "google-sub-unverified",
          email: "unverified@example.test",
          email_verified: false,
        }),
        { status: 200 },
      );
    }
    return new Response("Not found", { status: 404 });
  };

  await assert.rejects(
    () =>
      exchangeCodeForTokens({
        code: "fake-code",
        codeVerifier: "fake-verifier",
        redirectUri: "http://localhost:3000/api/calendar/callback",
        clientId: "test-id",
        clientSecret: "test-sec",
        fetchFn: mockFetchUnverified as typeof fetch,
      }),
    (err: unknown) => {
      assert.ok(err instanceof GoogleOAuthError);
      assert.match(err.message, /não está verificado/);
      return true;
    },
  );
});

test("Revogação de token Google via corpo POST urlencoded com timeout (B3, I2)", async () => {
  let capturedBody = "";
  let capturedContentType = "";
  let capturedUrl = "";

  const mockRevokeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedBody = String(init?.body ?? "");
    capturedContentType = String((init?.headers as Record<string, string>)?.["Content-Type"] ?? "");
    assert.ok(init?.signal, "Deve fornecer AbortSignal para timeout de segurança");
    return new Response("", { status: 200 });
  };

  await revokeGoogleToken({
    token: "refresh-token-para-revogar-123",
    fetchFn: mockRevokeFetch as typeof fetch,
  });

  assert.equal(capturedUrl, "https://oauth2.googleapis.com/revoke");
  assert.equal(capturedContentType, "application/x-www-form-urlencoded");
  assert.equal(capturedBody, "token=refresh-token-para-revogar-123");
});

test("Limite máximo de 5 contas vinculadas por usuário (B5)", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userLim = {
    id: `user-limite-${randomBytes(6).toString("hex")}`,
    email: "limite@example.test",
    name: "Usuário Limite",
  };

  await withDatabase(async (db) => {
    // Insere 5 contas diferentes com sucesso
    for (let i = 1; i <= 5; i++) {
      const sub = `sub-google-${i}`;
      const tokenEnc = encryptToken(`token-${i}`, testKey, `${userLim.id}:${sub}`);
      await saveCalendarAccount(db, userLim, {
        googleSub: sub,
        email: `conta${i}@exemplo.test`,
        refreshTokenEnc: tokenEnc,
      });
    }

    const contas = await listCalendarAccounts(db, userLim);
    assert.equal(contas.length, 5);

    // Tentativa de adicionar a 6ª conta (com sub novo) é bloqueada com mensagem em pt-BR
    const sub6 = "sub-google-6";
    const token6 = encryptToken("token-6", testKey, `${userLim.id}:${sub6}`);
    await assert.rejects(
      () =>
        saveCalendarAccount(db, userLim, {
          googleSub: sub6,
          email: "conta6@exemplo.test",
          refreshTokenEnc: token6,
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Limite máximo de 5 contas Google atingido/);
        return true;
      },
    );

    // Reconectar uma das 5 contas já existentes (mesmo googleSub) deve ser permitido para atualização de token
    const token1Novo = encryptToken("token-1-renovado", testKey, `${userLim.id}:sub-google-1`);
    await saveCalendarAccount(db, userLim, {
      googleSub: "sub-google-1",
      email: "conta1-novoemail@exemplo.test",
      refreshTokenEnc: token1Novo,
    });

    const contasAposUpdate = await listCalendarAccounts(db, userLim);
    assert.equal(contasAposUpdate.length, 5);
    const conta1 = contasAposUpdate.find((c) => c.googleSub === "sub-google-1");
    assert.equal(conta1?.email, "conta1-novoemail@exemplo.test");
  });
});

test("Limite de 5 contas com conexões concorrentes via Promise.all e advisory lock", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userConc = {
    id: `user-concorrente-${randomBytes(6).toString("hex")}`,
    email: "concorrente@example.test",
    name: "Usuário Concorrente",
  };

  await withDatabase(async (db) => {
    // Insere previamente 4 contas
    for (let i = 1; i <= 4; i++) {
      const sub = `sub-previo-${i}`;
      await saveCalendarAccount(db, userConc, {
        googleSub: sub,
        email: `conta${i}@previo.test`,
        refreshTokenEnc: encryptToken(`token-${i}`, testKey, `${userConc.id}:${sub}`),
      });
    }

    const contasIniciais = await listCalendarAccounts(db, userConc);
    assert.equal(contasIniciais.length, 4);

    // Dispara duas conexões simultâneas concorrentes com Promise.allSettled (tentando ser a 5ª e a 6ª)
    const contaA = {
      googleSub: "sub-concorrente-A",
      email: "contaA@concorrente.test",
      refreshTokenEnc: encryptToken("token-A", testKey, `${userConc.id}:sub-concorrente-A`),
    };
    const contaB = {
      googleSub: "sub-concorrente-B",
      email: "contaB@concorrente.test",
      refreshTokenEnc: encryptToken("token-B", testKey, `${userConc.id}:sub-concorrente-B`),
    };

    const results = await Promise.allSettled([
      saveCalendarAccount(db, userConc, contaA),
      saveCalendarAccount(db, userConc, contaB),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Graças ao advisory lock transacional, exatamente uma passa e a outra é bloqueada
    assert.equal(fulfilled.length, 1, "Exatamente uma conta deve ser aceita atingindo o limite de 5");
    assert.equal(rejected.length, 1, "A conta excedente concorrente deve ser rejeitada");

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(rejectionReason instanceof CalendarAccountLimitError);
    assert.match(rejectionReason.message, /Limite máximo de 5 contas Google atingido/);

    const contasFinais = await listCalendarAccounts(db, userConc);
    assert.equal(contasFinais.length, 5, "Banco deve conter exatamente 5 contas após concorrência");
  });
});

test("Fetches de OAuth incluem AbortSignal para timeout de segurança (N2)", async () => {
  let tokenSignalCaptured = false;
  let userinfoSignalCaptured = false;
  let refreshSignalCaptured = false;

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = String(input);
    if (urlStr.includes("oauth2.googleapis.com/token")) {
      const bodyStr = String(init?.body ?? "");
      if (bodyStr.includes("grant_type=refresh_token")) {
        if (init?.signal) refreshSignalCaptured = true;
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (init?.signal) tokenSignalCaptured = true;
      return new Response(
        JSON.stringify({
          access_token: "mock-acc",
          refresh_token: "mock-ref",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    }
    if (urlStr.includes("openidconnect.googleapis.com/v1/userinfo")) {
      if (init?.signal) userinfoSignalCaptured = true;
      return new Response(
        JSON.stringify({
          sub: "mock-sub",
          email: "mock@test.com",
          email_verified: true,
        }),
        { status: 200 },
      );
    }
    return new Response("Not found", { status: 404 });
  };

  await exchangeCodeForTokens({
    code: "c",
    codeVerifier: "v",
    redirectUri: "http://localhost/cb",
    clientId: "id",
    clientSecret: "sec",
    fetchFn: mockFetch as typeof fetch,
  });

  await refreshGoogleAccessToken({
    refreshToken: "ref",
    clientId: "id",
    clientSecret: "sec",
    fetchFn: mockFetch as typeof fetch,
  });

  assert.equal(tokenSignalCaptured, true, "fetch de token deve ter signal");
  assert.equal(userinfoSignalCaptured, true, "fetch de userinfo deve ter signal");
  assert.equal(refreshSignalCaptured, true, "fetch de refresh deve ter signal");
});

test("Sanitização de links de eventos htmlLink (I4)", () => {
  assert.equal(isValidCalendarHtmlLink("https://www.google.com/calendar/event?eid=123"), true);
  assert.equal(isValidCalendarHtmlLink("https://calendar.google.com/calendar/r/eventedit/123"), true);

  // Rejeições de segurança
  assert.equal(isValidCalendarHtmlLink("javascript:alert(document.cookie)"), false);
  assert.equal(isValidCalendarHtmlLink("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isValidCalendarHtmlLink("https://evil.com/phishing"), false);
  assert.equal(isValidCalendarHtmlLink("http://www.google.com/insecure"), false);
  assert.equal(isValidCalendarHtmlLink(""), false);
  assert.equal(isValidCalendarHtmlLink(undefined), false);
});

test("Mensagens de erro e sucesso da UI mapeadas para códigos fixos (I5)", () => {
  assert.ok(CALENDAR_ERROR_MESSAGES.access_denied);
  assert.ok(CALENDAR_ERROR_MESSAGES.missing_params);
  assert.ok(CALENDAR_ERROR_MESSAGES.invalid_session);
  assert.ok(CALENDAR_ERROR_MESSAGES.invalid_state);
  assert.ok(CALENDAR_ERROR_MESSAGES.user_mismatch);
  assert.ok(CALENDAR_ERROR_MESSAGES.unconfigured);
  assert.ok(CALENDAR_ERROR_MESSAGES.no_offline_access);
  assert.ok(CALENDAR_ERROR_MESSAGES.email_unverified);
  assert.ok(CALENDAR_ERROR_MESSAGES.account_limit);
  assert.ok(CALENDAR_ERROR_MESSAGES.auth_failed);
  assert.ok(CALENDAR_ERROR_MESSAGES.remove_failed);
  assert.ok(CALENDAR_ERROR_MESSAGES.invalid_account);

  assert.ok(CALENDAR_SUCCESS_MESSAGES.connected);
  assert.ok(CALENDAR_SUCCESS_MESSAGES.removed);

  // Mensagens arbitrárias externas não existem no dicionário
  assert.equal(CALENDAR_ERROR_MESSAGES["<script>alert(1)</script>"], undefined);
  assert.equal(CALENDAR_ERROR_MESSAGES["qualquer texto arbitrario"], undefined);
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

    // 2. Salva conta para A com AAD vinculado
    const tokenA = encryptToken("token-a", testKey, `${USER_A.id}:sub-google-a`);
    await saveCalendarAccount(db, USER_A, {
      googleSub: "sub-google-a",
      email: "conta-a@gmail.test",
      refreshTokenEnc: tokenA,
    });

    // 3. Salva conta para B com AAD vinculado
    const tokenB = encryptToken("token-b", testKey, `${USER_B.id}:sub-google-b`);
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
    // Conecta duas contas para o mesmo usuário com AAD
    await saveCalendarAccount(db, userResiliente, {
      googleSub: "sub-conta-1-revogada",
      email: "expirada@trabalho.test",
      refreshTokenEnc: encryptToken("token-revogado", testKey, `${userResiliente.id}:sub-conta-1-revogada`),
    });

    await saveCalendarAccount(db, userResiliente, {
      googleSub: "sub-conta-2-valida",
      email: "ativa@estudos.test",
      refreshTokenEnc: encryptToken("token-valido", testKey, `${userResiliente.id}:sub-conta-2-valida`),
    });

    const contas = await listCalendarAccounts(db, userResiliente);
    assert.equal(contas.length, 2);

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
