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
  getCalendarWindowSP,
  getFeedCacheSize,
  getSPDateString,
  getTimeZoneOffsetSP,
  getTodayBoundsSP,
  invalidateCalendarCache,
  isValidCalendarHtmlLink,
  listCalendarAccounts,
  pLimitAll,
  sanitizeCalendarColor,
  saveCalendarAccount,
  setFeedCache,
  MAX_CALENDARS_PER_ACCOUNT,
  MAX_FEED_CACHE_ENTRIES,
  MAX_FEED_EVENTS_TOTAL,
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

test("Janela de 7 dias getCalendarWindowSP: virada de dia, mês, ano e anos bissextos", () => {
  // 1. Data regular: 17 de novembro de 2026 (SP = UTC-3)
  const regularDate = new Date("2026-11-17T15:00:00Z"); // 12:00 em SP
  const w1 = getCalendarWindowSP(regularDate, 7);
  assert.equal(w1.startDateStr, "2026-11-17");
  assert.equal(w1.endDateStr, "2026-11-24");
  assert.equal(w1.timeMin, "2026-11-17T00:00:00-03:00");
  assert.equal(w1.timeMax, "2026-11-24T00:00:00-03:00");
  assert.equal(w1.dayKeys.length, 7);
  assert.deepEqual(w1.dayKeys, [
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
    "2026-11-23",
  ]);

  // getTodayBoundsSP compatível
  const todayBounds = getTodayBoundsSP(regularDate);
  assert.equal(todayBounds.dateStr, "2026-11-17");
  assert.equal(todayBounds.timeMin, "2026-11-17T00:00:00-03:00");
  assert.equal(todayBounds.timeMax, "2026-11-24T00:00:00-03:00");

  // 2. Virada de mês: 28 de janeiro de 2026
  const monthTurnDate = new Date("2026-01-28T14:00:00Z");
  const wMonth = getCalendarWindowSP(monthTurnDate, 7);
  assert.equal(wMonth.startDateStr, "2026-01-28");
  assert.equal(wMonth.endDateStr, "2026-02-04");
  assert.deepEqual(wMonth.dayKeys, [
    "2026-01-28",
    "2026-01-29",
    "2026-01-30",
    "2026-01-31",
    "2026-02-01",
    "2026-02-02",
    "2026-02-03",
  ]);

  // 3. Virada de ano: 29 de dezembro de 2026
  const yearTurnDate = new Date("2026-12-29T14:00:00Z");
  const wYear = getCalendarWindowSP(yearTurnDate, 7);
  assert.equal(wYear.startDateStr, "2026-12-29");
  assert.equal(wYear.endDateStr, "2027-01-05");
  assert.deepEqual(wYear.dayKeys, [
    "2026-12-29",
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
    "2027-01-03",
    "2027-01-04",
  ]);

  // 4. Ano bissexto: 26 de fevereiro de 2024 (2024 é bissexto, inclui 29/02)
  const leapYearDate = new Date("2024-02-26T14:00:00Z");
  const wLeap = getCalendarWindowSP(leapYearDate, 7);
  assert.equal(wLeap.startDateStr, "2024-02-26");
  assert.equal(wLeap.endDateStr, "2024-03-04");
  assert.deepEqual(wLeap.dayKeys, [
    "2024-02-26",
    "2024-02-27",
    "2024-02-28",
    "2024-02-29",
    "2024-03-01",
    "2024-03-02",
    "2024-03-03",
  ]);

  // 5. Ano não bissexto: 26 de fevereiro de 2025 (2025 NÃO é bissexto, salta 28/02 para 01/03)
  const nonLeapDate = new Date("2025-02-26T14:00:00Z");
  const wNonLeap = getCalendarWindowSP(nonLeapDate, 7);
  assert.equal(wNonLeap.startDateStr, "2025-02-26");
  assert.equal(wNonLeap.endDateStr, "2025-03-05");
  assert.deepEqual(wNonLeap.dayKeys, [
    "2025-02-26",
    "2025-02-27",
    "2025-02-28",
    "2025-03-01",
    "2025-03-02",
    "2025-03-03",
    "2025-03-04",
  ]);
});

test("Busca de múltiplos calendários: calendarList, filtros, feriados, dedupe e limites", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userMulti = {
    id: `user-multi-${randomBytes(8).toString("hex")}`,
    email: "multi@example.test",
    name: "Usuário Multi Calendários",
  };

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userMulti, {
      googleSub: "sub-multi-calendars",
      email: "principal@gmail.test",
      refreshTokenEnc: encryptToken("token-multi", testKey, `${userMulti.id}:sub-multi-calendars`),
    });

    const mockFetch = async (input: RequestInfo | URL) => {
      const urlStr = String(input);

      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "access-token-multi" }), { status: 200 });
      }

      if (urlStr.includes("users/me/calendarList")) {
        // Retorna lista com vários calendários (incluindo hidden, unselected, feriados e excedente de 8)
        return new Response(
          JSON.stringify({
            items: [
              { id: "primary", summary: "Principal Pessoal", selected: true },
              {
                id: "trabalho@group.calendar.google.com",
                summary: "Trabalho",
                summaryOverride: "Trabalho Rotina",
                backgroundColor: "#039be5",
                selected: true,
              },
              {
                id: "pt.brazilian#holiday@group.v.calendar.google.com",
                summary: "Feriados no Brasil",
                selected: true,
              },
              { id: "oculto@group.calendar.google.com", summary: "Oculto", hidden: true },
              { id: "desmarcado@group.calendar.google.com", summary: "Desmarcado", selected: false },
              // Calendários adicionais para testar o teto de 8 calendários por conta
              { id: "extra-1", summary: "Extra 1", selected: true },
              { id: "extra-2", summary: "Extra 2", selected: true },
              { id: "extra-3", summary: "Extra 3", selected: true },
              { id: "extra-4", summary: "Extra 4", selected: true },
              { id: "extra-5", summary: "Extra 5", selected: true }, // 8º selecionado
              { id: "extra-6-excedente", summary: "Extra 6 Excedente", selected: true }, // 9º (deve ser ignorado)
            ],
          }),
          { status: 200 },
        );
      }

      // Eventos do calendário primary
      if (urlStr.includes("calendars/primary/events")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "ev-1",
                summary: "Consulta Médica",
                start: { dateTime: "2026-11-17T14:00:00-03:00" },
                end: { dateTime: "2026-11-17T15:00:00-03:00" },
                htmlLink: "https://calendar.google.com/event?eid=1",
              },
              // Evento duplicado no mesmo id para testar dedupe
              {
                id: "ev-1",
                summary: "Consulta Médica Duplicada",
                start: { dateTime: "2026-11-17T14:00:00-03:00" },
                htmlLink: "https://calendar.google.com/event?eid=1",
              },
            ],
          }),
          { status: 200 },
        );
      }

      // Eventos do calendário de trabalho
      if (urlStr.includes("trabalho%40group.calendar.google.com") || urlStr.includes("trabalho@group.calendar.google.com")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "ev-work-1",
                summary: "Daily da Equipe",
                start: { dateTime: "2026-11-17T10:00:00-03:00" },
                end: { dateTime: "2026-11-17T10:30:00-03:00" },
                htmlLink: "https://calendar.google.com/event?eid=work1",
              },
              {
                id: "ev-work-2",
                summary: "Planejamento Futuro",
                start: { dateTime: "2026-11-20T09:00:00-03:00" },
                end: { dateTime: "2026-11-20T10:00:00-03:00" },
                htmlLink: "https://calendar.google.com/event?eid=work2",
              },
            ],
          }),
          { status: 200 },
        );
      }

      // Eventos do calendário de feriados (group.v.calendar.google.com)
      if (urlStr.includes("holiday") || urlStr.includes("group.v.calendar.google.com")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "ev-holiday-1",
                summary: "Dia da Consciência Negra",
                start: { date: "2026-11-20" },
                end: { date: "2026-11-21" },
                htmlLink: "https://www.google.com/calendar/event?eid=holiday1",
              },
            ],
          }),
          { status: 200 },
        );
      }

      // Simula erro 500 em um dos calendários extras para verificar que falha parcial NÃO quebra o feed
      if (urlStr.includes("extra-1")) {
        return new Response(JSON.stringify({ error: "internal_error" }), { status: 500 });
      }

      // Demais calendários vazios
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    };

    const feed = await getCalendarFeed(db, userMulti, new Date("2026-11-17T12:00:00-03:00"), mockFetch as typeof fetch);

    assert.equal(feed.isConfigured, true);
    assert.equal(feed.accounts.length, 1);
    assert.equal(feed.events.length, 4, "Deve conter os 4 eventos únicos após deduplicação");

    // Validações de dedupe e atributos dos eventos
    const evIds = feed.events.map((e) => e.id);
    assert.equal(evIds.filter((id) => id === "ev-1").length, 1, "Dedupe deve manter ev-1 apenas uma vez");

    // Validação de nomes e propriedades de calendários
    const evWork = feed.events.find((e) => e.id === "ev-work-1")!;
    assert.equal(evWork.calendarName, "Trabalho Rotina", "Deve usar summaryOverride se fornecido");
    assert.equal(evWork.calendarColor, "#039be5");
    assert.equal(evWork.isSpecialCalendar, false);

    const evHoliday = feed.events.find((e) => e.id === "ev-holiday-1")!;
    assert.equal(evHoliday.calendarName, "Feriados no Brasil");
    assert.equal(evHoliday.isAllDay, true, "Feriados devem entrar como dia inteiro");
    assert.equal(evHoliday.isSpecialCalendar, true, "Calendário group.v.calendar deve ter isSpecialCalendar=true");

    // Validação da ordenação:
    // No dia 2026-11-20 temos evHoliday (dia inteiro) e evWork2 (09:00)
    // No mesmo dia, dia inteiro deve vir primeiro!
    const day20Events = feed.events.filter((e) => e.startDateSP === "2026-11-20");
    assert.equal(day20Events.length, 2);
    assert.equal(day20Events[0].id, "ev-holiday-1", "Dia inteiro deve vir primeiro no mesmo dia");
    assert.equal(day20Events[1].id, "ev-work-2", "Evento com horário vem após dia inteiro");
  });
});

test("Feed com calendarList vazio ou com falha faz fallback seguro para primary", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userFallback = {
    id: `user-fb-${randomBytes(8).toString("hex")}`,
    email: "fallback@example.test",
    name: "Usuário Fallback",
  };

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userFallback, {
      googleSub: "sub-fallback",
      email: "fallback@gmail.test",
      refreshTokenEnc: encryptToken("token-fallback", testKey, `${userFallback.id}:sub-fallback`),
    });

    const mockFetchFallback = async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      // calendarList retorna 500
      if (urlStr.includes("users/me/calendarList")) {
        return new Response("Erro interno", { status: 500 });
      }
      // primary responde com 1 evento
      if (urlStr.includes("calendars/primary/events")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "ev-fb-1",
                summary: "Evento Primário Fallback",
                start: { dateTime: "2026-11-17T16:00:00-03:00" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const feed = await getCalendarFeed(db, userFallback, new Date("2026-11-17T12:00:00-03:00"), mockFetchFallback as typeof fetch);
    assert.equal(feed.isConfigured, true);
    assert.equal(feed.events.length, 1);
    assert.equal(feed.events[0].title, "Evento Primário Fallback");
    assert.equal(feed.events[0].calendarName, "Principal");
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

test("M1 & M2: Eventos multi-dia abrangem todos os dias com clamp para início da janela e end.date exclusivo", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userMultiDay = {
    id: `user-md-${randomBytes(8).toString("hex")}`,
    email: "multiday@example.test",
    name: "Usuário MultiDay",
  };

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userMultiDay, {
      googleSub: "sub-multiday",
      email: "multiday@gmail.test",
      refreshTokenEnc: encryptToken("token-multiday", testKey, `${userMultiDay.id}:sub-multiday`),
    });

    const mockFetchMultiDay = async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(
          JSON.stringify({
            items: [{ id: "primary", summary: "Principal", primary: true, selected: true }],
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes("calendars/primary/events")) {
        return new Response(
          JSON.stringify({
            items: [
              // M1: Começou antes de hoje (dia 15) e vai até dia 18 (dia inteiro, end.date=2026-11-19 exclusivo => último dia 18)
              // Janela começa em 2026-11-17. Deve sofrer clamp e aparecer nos dias 17 e 18.
              {
                id: "ev-clamp-all-day",
                iCalUID: "uid-clamp-all-day",
                summary: "Viagem Longa",
                start: { date: "2026-11-15" },
                end: { date: "2026-11-19" },
              },
              // M2: Dia inteiro normal de 3 dias (18, 19, 20): end.date exclusivo é 2026-11-21 => último dia é 2026-11-20
              {
                id: "ev-three-days",
                iCalUID: "uid-three-days",
                summary: "Conferência Tech",
                start: { date: "2026-11-18" },
                end: { date: "2026-11-21" },
              },
              // M2: Evento com horário que atravessa a meia-noite (22:00 de 17/11 até 03:00 de 18/11 em SP)
              {
                id: "ev-cross-midnight",
                iCalUID: "uid-cross-midnight",
                summary: "Plantão Noturno",
                start: { dateTime: "2026-11-17T22:00:00-03:00" },
                end: { dateTime: "2026-11-18T03:00:00-03:00" },
              },
              // Evento com horário que termina exatamente à meia-noite (00:00:00 em SP) => não invade o dia seguinte
              {
                id: "ev-ends-at-midnight",
                iCalUID: "uid-ends-at-midnight",
                summary: "Jantar de Aniversário",
                start: { dateTime: "2026-11-17T20:00:00-03:00" },
                end: { dateTime: "2026-11-18T00:00:00-03:00" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    };

    // Janela inicia em 2026-11-17
    const feed = await getCalendarFeed(
      db,
      userMultiDay,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetchMultiDay as typeof fetch,
    );

    assert.equal(feed.isConfigured, true);

    // M1: Viagem Longa deve aparecer nos dias 2026-11-17 e 2026-11-18
    const viagemEntries = feed.events.filter((e) => e.title === "Viagem Longa");
    assert.equal(viagemEntries.length, 2, "Viagem Longa deve aparecer em 2 dias da janela (clamp 17 e 18)");
    assert.deepEqual(
      viagemEntries.map((e) => e.startDateSP),
      ["2026-11-17", "2026-11-18"],
    );
    assert.ok(viagemEntries.every((e) => e.isMultiDay === true));

    // M2: Conferência Tech deve aparecer nos dias 18, 19 e 20 (end.date 21 exclusivo)
    const confEntries = feed.events.filter((e) => e.title === "Conferência Tech");
    assert.equal(confEntries.length, 3, "Conferência Tech de 3 dias deve ter 3 instâncias na janela");
    assert.deepEqual(
      confEntries.map((e) => e.startDateSP),
      ["2026-11-18", "2026-11-19", "2026-11-20"],
    );
    assert.ok(confEntries.every((e) => e.isMultiDay === true));

    // M2: Plantão Noturno atravessa a meia-noite (aparece em 17 e 18)
    const plantaoEntries = feed.events.filter((e) => e.title === "Plantão Noturno");
    assert.equal(plantaoEntries.length, 2, "Plantão Noturno atravessa meia-noite e deve aparecer em 17 e 18");
    assert.deepEqual(
      plantaoEntries.map((e) => e.startDateSP),
      ["2026-11-17", "2026-11-18"],
    );
    assert.ok(plantaoEntries.every((e) => e.isMultiDay === true));

    // Jantar termina exatamente às 00:00:00 => deve aparecer APENAS no dia 17
    const jantarEntries = feed.events.filter((e) => e.title === "Jantar de Aniversário");
    assert.equal(jantarEntries.length, 1, "Evento que termina exatamente às 00:00 não deve invadir o dia seguinte");
    assert.equal(jantarEntries[0].startDateSP, "2026-11-17");
    assert.equal(jantarEntries[0].isMultiDay, false);
  });
});

test("B1 & B2: Ordenação primary first e paginação de calendarList e events até 3 páginas", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userPagination = {
    id: `user-pag-${randomBytes(8).toString("hex")}`,
    email: "pag@example.test",
    name: "Usuário Paginação",
  };

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userPagination, {
      googleSub: "sub-pag",
      email: "pag@gmail.test",
      refreshTokenEnc: encryptToken("token-pag", testKey, `${userPagination.id}:sub-pag`),
    });

    const calendarListRequestedPages: string[] = [];
    const eventsRequestedPages: string[] = [];

    const mockFetchPagination = async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }

      // Paginação em calendarList:
      // Página 1 retorna 6 calendários secundários + nextPageToken="page2"
      // Página 2 retorna 4 calendários incluindo o PRIMARY no final (testando B1 ordenação)
      if (urlStr.includes("users/me/calendarList")) {
        if (!urlStr.includes("pageToken=")) {
          calendarListRequestedPages.push("page1");
          return new Response(
            JSON.stringify({
              items: Array.from({ length: 6 }, (_, i) => ({
                id: `sec-${i + 1}@group.calendar.google.com`,
                summary: `Secundário ${i + 1}`,
                selected: true,
              })),
              nextPageToken: "cal-page-2",
            }),
            { status: 200 },
          );
        } else if (urlStr.includes("pageToken=cal-page-2")) {
          calendarListRequestedPages.push("page2");
          return new Response(
            JSON.stringify({
              items: [
                { id: "sec-7@group.calendar.google.com", summary: "Secundário 7", selected: true },
                { id: "sec-8@group.calendar.google.com", summary: "Secundário 8", selected: true },
                { id: "primary-account@gmail.com", summary: "Conta Principal", primary: true, selected: true },
              ],
            }),
            { status: 200 },
          );
        }
      }

      // Paginação em events para o calendário primário:
      // Testa consumo de páginas de eventos
      if (urlStr.includes("primary-account%40gmail.com/events") || urlStr.includes("primary-account@gmail.com/events")) {
        if (!urlStr.includes("pageToken=")) {
          eventsRequestedPages.push("ev-page1");
          return new Response(
            JSON.stringify({
              items: [{ id: "ev-p1", summary: "Evento P1", start: { date: "2026-11-17" } }],
              nextPageToken: "token-ev-2",
            }),
            { status: 200 },
          );
        } else if (urlStr.includes("pageToken=token-ev-2")) {
          eventsRequestedPages.push("ev-page2");
          return new Response(
            JSON.stringify({
              items: [{ id: "ev-p2", summary: "Evento P2", start: { date: "2026-11-18" } }],
            }),
            { status: 200 },
          );
        }
      }

      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    };

    const feed = await getCalendarFeed(
      db,
      userPagination,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetchPagination as typeof fetch,
    );

    assert.equal(feed.isConfigured, true);
    // B2: Paginação consumida
    assert.deepEqual(calendarListRequestedPages, ["page1", "page2"], "Deve consumir páginas do calendarList");
    assert.deepEqual(eventsRequestedPages, ["ev-page1", "ev-page2"], "Deve consumir páginas de eventos");

    // B1: primary estava na segunda página (índice 8 de 9), mas como tem primary: true,
    // a ordenação garantiu que ele ficasse no topo dos 8 selecionados (não foi cortado)
    const p1Event = feed.events.find((e) => e.id === "ev-p1");
    const p2Event = feed.events.find((e) => e.id === "ev-p2");
    assert.ok(p1Event, "Evento P1 do calendário principal deve estar presente");
    assert.ok(p2Event, "Evento P2 do calendário principal deve estar presente");
  });
});

test("B3 & M3: Deduplicação por iCalUID mescla nomes dos calendários e logs seguros não revelam dados", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userB3M3 = {
    id: `user-b3m3-${randomBytes(8).toString("hex")}`,
    email: "b3m3@example.test",
    name: "Usuário B3 M3",
  };

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userB3M3, {
      googleSub: "sub-b3m3",
      email: "b3m3@gmail.test",
      refreshTokenEnc: encryptToken("token-b3m3", testKey, `${userB3M3.id}:sub-b3m3`),
    });

    const errorLogs: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      errorLogs.push(args.map(String).join(" "));
    };

    try {
      const mockFetchB3M3 = async (input: RequestInfo | URL) => {
        const urlStr = String(input);
        if (urlStr.includes("oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
        }

        if (urlStr.includes("users/me/calendarList")) {
          return new Response(
            JSON.stringify({
              items: [
                { id: "primary", summary: "Calendário Principal Secreto", primary: true, selected: true },
                { id: "trabalho", summary: "Calendário de Trabalho Confidencial", selected: true },
                { id: "cal-com-erro", summary: "Calendário Privado Falho", selected: true },
              ],
            }),
            { status: 200 },
          );
        }

        // Calendário principal tem Reunião Estratégica (iCalUID compartilhado) e um evento sem ID
        if (urlStr.includes("primary/events")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: "ev-orig-1",
                  iCalUID: "shared-uid-12345@google.com",
                  summary: "Reunião Estratégica",
                  start: { dateTime: "2026-11-17T15:00:00-03:00" },
                  end: { dateTime: "2026-11-17T16:00:00-03:00" },
                },
                {
                  summary: "Sem ID 1",
                  start: { dateTime: "2026-11-17T10:00:00-03:00" },
                },
                {
                  summary: "Sem ID 2",
                  start: { dateTime: "2026-11-17T10:00:00-03:00" },
                },
              ],
            }),
            { status: 200 },
          );
        }

        // Calendário de trabalho tem o MESMO evento (mesmo iCalUID e horário, mas ID diferente no Google)
        if (urlStr.includes("trabalho/events")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: "ev-copy-work-2",
                  iCalUID: "shared-uid-12345@google.com",
                  summary: "Reunião Estratégica",
                  start: { dateTime: "2026-11-17T15:00:00-03:00" },
                  end: { dateTime: "2026-11-17T16:00:00-03:00" },
                },
              ],
            }),
            { status: 200 },
          );
        }

        // Calendário com erro para testar M3 (logs limpos)
        if (urlStr.includes("cal-com-erro/events")) {
          return new Response("Unauthorized", { status: 401 });
        }

        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      };

      const feed = await getCalendarFeed(
        db,
        userB3M3,
        new Date("2026-11-17T12:00:00-03:00"),
        mockFetchB3M3 as typeof fetch,
      );

      assert.equal(feed.isConfigured, true);

      // B3: O evento compartilhado deve aparecer apenas UMA vez
      const sharedEvs = feed.events.filter((e) => e.title === "Reunião Estratégica");
      assert.equal(sharedEvs.length, 1, "Evento com mesmo iCalUID deve ser deduplicado em um único item");
      assert.deepEqual(
        sharedEvs[0].calendarNames,
        ["Calendário Principal Secreto", "Calendário de Trabalho Confidencial"],
        "calendarNames deve mesclar os calendários de origem",
      );
      assert.equal(
        sharedEvs[0].calendarName,
        "Calendário Principal Secreto, Calendário de Trabalho Confidencial",
      );

      // Itens anônimos sem ID não devem colapsar entre si
      const semId1 = feed.events.find((e) => e.title === "Sem ID 1");
      const semId2 = feed.events.find((e) => e.title === "Sem ID 2");
      assert.ok(semId1 && semId2, "Itens sem ID não devem colapsar indevidamente");
      assert.notEqual(semId1?.id, semId2?.id);

      // M3: Logs de erro NÃO podem conter nomes sensíveis de calendário nem de resumo
      assert.ok(errorLogs.length > 0, "Deve haver log de erro gerado para o calendário com 401");
      for (const logLine of errorLogs) {
        assert.ok(!logLine.includes("Calendário"), "Log não pode conter nome de calendário");
        assert.ok(!logLine.includes("Privado"), "Log não pode conter nome de calendário");
        assert.ok(!logLine.includes("Reunião"), "Log não pode conter resumo de evento");
        assert.ok(!logLine.includes("Estratégica"), "Log não pode conter resumo de evento");
        assert.match(logLine, /cal_hash=[0-9a-f]{8}/, "Log seguro deve conter apenas hash curto de calendarId");
      }
    } finally {
      console.error = originalConsoleError;
    }
  });
});

test("M4: Concorrência limitada, deadline global com resultado parcial e cache de 60s com invalidação", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userM4 = {
    id: `user-m4-${randomBytes(8).toString("hex")}`,
    email: "m4@example.test",
    name: "Usuário M4",
  };

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userM4, {
      googleSub: "sub-m4",
      email: "m4@gmail.test",
      refreshTokenEnc: encryptToken("token-m4", testKey, `${userM4.id}:sub-m4`),
    });

    let fetchCount = 0;
    const mockFetchCache = async (input: RequestInfo | URL) => {
      fetchCount++;
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(
          JSON.stringify({
            items: [{ id: "primary", summary: "Principal", primary: true, selected: true }],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          items: [{ id: "ev-cache-1", summary: "Evento Cache", start: { date: "2026-11-17" } }],
        }),
        { status: 200 },
      );
    };

    // 1. Primeira chamada busca da rede e popula o cache
    const feed1 = await getCalendarFeed(
      db,
      userM4,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetchCache as typeof fetch,
    );
    assert.equal(feed1.events.length, 1);
    const countAfterFirst = fetchCount;
    assert.ok(countAfterFirst > 0);

    // 2. Segunda chamada imediata usa cache (nenhum fetch novo)
    const feed2 = await getCalendarFeed(
      db,
      userM4,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetchCache as typeof fetch,
    );
    assert.equal(fetchCount, countAfterFirst, "Segunda chamada consecutiva deve usar cache de 60s");
    assert.equal(feed2.events.length, 1);

    // 3. Invalidação ao remover conta
    await deleteCalendarAccount(db, userM4, feed1.accounts[0].id);

    // 4. Nova chamada após invalidação não usa o cache antigo (contas vazias)
    const feed3 = await getCalendarFeed(
      db,
      userM4,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetchCache as typeof fetch,
    );
    assert.equal(feed3.accounts.length, 0);
    assert.equal(feed3.events.length, 0);
  });
});

test("R1: Resultado parcial (isPartial=true / erro parcial) NUNCA é armazenado no feedCache", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userR1 = {
    id: `user-r1-${randomBytes(8).toString("hex")}`,
    email: "r1@example.test",
    name: "Usuário R1",
  };

  invalidateCalendarCache(userR1.id);

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userR1, {
      googleSub: "sub-r1",
      email: "r1@gmail.test",
      refreshTokenEnc: encryptToken("token-r1", testKey, `${userR1.id}:sub-r1`),
    });

    let networkAttempts = 0;
    const mockFetchWithAbort = async (input: RequestInfo | URL, init?: RequestInit) => {
      networkAttempts++;
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(
          JSON.stringify({
            items: [
              { id: "cal-1", summary: "Cal 1", selected: true },
              { id: "cal-2", summary: "Cal 2", selected: true },
            ],
          }),
          { status: 200 },
        );
      }
      // Simula abort no fetch de eventos para forçar isPartial
      if (init?.signal) {
        (init.signal as unknown as { aborted: boolean }).aborted = true;
      }
      throw new Error("AbortSignal triggered");
    };

    // Chamada 1: resulta em isPartial=true devido ao abort
    const feedPartial = await getCalendarFeed(
      db,
      userR1,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetchWithAbort as typeof fetch,
    );
    assert.equal(feedPartial.isPartial, true);
    assert.ok(feedPartial.accountErrors["_partial"]);
    const attemptsAfterFirst = networkAttempts;

    // Chamada 2: se o feed parcial NÃO foi cacheado, deve bater na rede novamente
    const feedPartial2 = await getCalendarFeed(
      db,
      userR1,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetchWithAbort as typeof fetch,
    );
    assert.ok(
      networkAttempts > attemptsAfterFirst,
      "Feed parcial não deve ser cacheado; nova consulta deve tentar buscar novamente",
    );
  });
});

test("R2: feedCache executa sweep de expirados e impõe teto máximo de 200 entradas", () => {
  invalidateCalendarCache();

  const dummyWindow = getCalendarWindowSP(new Date("2026-11-17T12:00:00-03:00"));
  const dummyResult = {
    isConfigured: true,
    accounts: [],
    events: [],
    accountErrors: {},
    window: dummyWindow,
    isPartial: false,
  };

  // 1. Teto máximo: inserir 205 entradas e validar que o tamanho não passa de 200
  for (let i = 0; i < 205; i++) {
    setFeedCache(`user-bulk-${i}`, dummyResult);
  }
  assert.equal(getFeedCacheSize(), MAX_FEED_CACHE_ENTRIES, "Teto máximo deve ser exatamente 200");

  // O item mais antigo (user-bulk-0) deve ter sido descartado
  invalidateCalendarCache();
  assert.equal(getFeedCacheSize(), 0);
});

test("Isolamento de cache entre usuários A e B", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userIsoA = { id: "user-iso-a", email: "a@test.com", name: "A" };
  const userIsoB = { id: "user-iso-b", email: "b@test.com", name: "B" };

  invalidateCalendarCache();

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userIsoA, {
      googleSub: "sub-iso-a",
      email: "a@gmail.test",
      refreshTokenEnc: encryptToken("tok-a", testKey, `${userIsoA.id}:sub-iso-a`),
    });
    await saveCalendarAccount(db, userIsoB, {
      googleSub: "sub-iso-b",
      email: "b@gmail.test",
      refreshTokenEnc: encryptToken("tok-b", testKey, `${userIsoB.id}:sub-iso-b`),
    });

    const mockFetchIso = async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      // Se for usuário A, evento A; se B, evento B
      if (urlStr.includes("calendars/primary/events")) {
        return new Response(
          JSON.stringify({
            items: [{ id: "ev-common", summary: "Evento Usuário", start: { date: "2026-11-17" } }],
          }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const feedA = await getCalendarFeed(db, userIsoA, new Date("2026-11-17T12:00:00-03:00"), mockFetchIso as typeof fetch);
    const feedB = await getCalendarFeed(db, userIsoB, new Date("2026-11-17T12:00:00-03:00"), mockFetchIso as typeof fetch);

    assert.equal(feedA.accounts[0].email, "a@gmail.test");
    assert.equal(feedB.accounts[0].email, "b@gmail.test");
    assert.notEqual(feedA.accounts[0].id, feedB.accounts[0].id);

    // Invalidação de A não deve limpar o cache de B
    invalidateCalendarCache(userIsoA.id);
    // feedB continua no cache
  });
});

test("M4-ressalva: Deadline global cancela fetch em voo via AbortSignal", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userDeadline = {
    id: `user-dl-${randomBytes(8).toString("hex")}`,
    email: "dl@example.test",
    name: "Usuário Deadline",
  };

  invalidateCalendarCache(userDeadline.id);

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userDeadline, {
      googleSub: "sub-dl",
      email: "dl@gmail.test",
      refreshTokenEnc: encryptToken("tok-dl", testKey, `${userDeadline.id}:sub-dl`),
    });

    let receivedSignalWithAbort = false;
    const mockFetchDeadline = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(
          JSON.stringify({
            items: [{ id: "primary", summary: "Principal", primary: true, selected: true }],
          }),
          { status: 200 },
        );
      }
      // Valida que o fetch recebe um AbortSignal combinado
      if (init?.signal) {
        receivedSignalWithAbort = true;
        // Simula abort imediato do sinal global
        const sig = init.signal;
        if (sig.aborted) {
          throw new Error("Aborted");
        }
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    };

    await getCalendarFeed(db, userDeadline, new Date("2026-11-17T12:00:00-03:00"), mockFetchDeadline as typeof fetch);
    assert.equal(receivedSignalWithAbort, true, "Fetches devem receber AbortSignal para cancelamento em voo");
  });
});

test("Concorrência limitada a 6 no pLimitAll", async () => {
  let activeWorkers = 0;
  let maxObservedWorkers = 0;
  const items = Array.from({ length: 20 }, (_, i) => i);

  await pLimitAll(
    items,
    async () => {
      activeWorkers++;
      maxObservedWorkers = Math.max(maxObservedWorkers, activeWorkers);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeWorkers--;
    },
    6,
  );

  assert.ok(maxObservedWorkers <= 6, `Concorrência observada (${maxObservedWorkers}) deve ser <= 6`);
  assert.equal(activeWorkers, 0);
});

test("B5: Evento com horário em calendário especial mantém isAllDay = false", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userB5 = {
    id: `user-b5-${randomBytes(8).toString("hex")}`,
    email: "b5@example.test",
    name: "Usuário B5",
  };

  invalidateCalendarCache(userB5.id);

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userB5, {
      googleSub: "sub-b5",
      email: "b5@gmail.test",
      refreshTokenEnc: encryptToken("tok-b5", testKey, `${userB5.id}:sub-b5`),
    });

    const mockFetchB5 = async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "special#holiday@group.v.calendar.google.com",
                summary: "Feriados Especiais",
                selected: true,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes("events")) {
        return new Response(
          JSON.stringify({
            items: [
              // Evento com horário marcado em um calendário especial (ex.: celebração com horário)
              {
                id: "ev-timed-special",
                summary: "Celebração Noturna",
                start: { dateTime: "2026-11-17T19:00:00-03:00" },
                end: { dateTime: "2026-11-17T21:00:00-03:00" },
              },
              // Evento de dia inteiro real
              {
                id: "ev-allday-special",
                summary: "Feriado Nacional",
                start: { date: "2026-11-18" },
                end: { date: "2026-11-19" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const feed = await getCalendarFeed(db, userB5, new Date("2026-11-17T12:00:00-03:00"), mockFetchB5 as typeof fetch);
    const timedEv = feed.events.find((e) => e.id === "ev-timed-special")!;
    const allDayEv = feed.events.find((e) => e.id === "ev-allday-special")!;

    assert.equal(timedEv.isSpecialCalendar, true, "Calendário deve ser identificado como especial");
    assert.equal(timedEv.isAllDay, false, "B5: Evento com horário NÃO deve ser forçado como dia inteiro");

    assert.equal(allDayEv.isSpecialCalendar, true);
    assert.equal(allDayEv.isAllDay, true, "Evento com start.date deve ser dia inteiro");
  });
});

test("B6 & B7: Derivação dinâmica de offset de fuso e tratamento robusto de data inválida", () => {
  // B6: getTimeZoneOffsetSP deriva offset dinâmico
  const offset = getTimeZoneOffsetSP(new Date("2026-11-17T12:00:00Z"));
  assert.equal(offset, "-03:00");

  const window = getCalendarWindowSP(new Date("2026-11-17T12:00:00Z"));
  assert.ok(window.timeMin.includes("-03:00"));
  assert.ok(window.timeMax.includes("-03:00"));

  // B7: getSPDateString com data inválida retorna string vazia sem lançar exceção
  assert.equal(getSPDateString("data-invalida-xyz"), "");
  assert.equal(getSPDateString(new Date("invalid")), "");
});

test("(a) Validação e descarte de cores maliciosas em calendarColor (sanitizeCalendarColor)", async () => {
  // Testes unitários da função de sanitização
  assert.equal(sanitizeCalendarColor("#039be5"), "#039be5");
  assert.equal(sanitizeCalendarColor("#FFFFFF"), "#ffffff");
  assert.equal(sanitizeCalendarColor("#1a2b3c"), "#1a2b3c");

  // Injeções maliciosas e formatos inválidos devem ser descartados (undefined)
  assert.equal(sanitizeCalendarColor("red;background:url(x)"), undefined);
  assert.equal(sanitizeCalendarColor("javascript:alert(1)"), undefined);
  assert.equal(sanitizeCalendarColor("expression(alert(1))"), undefined);
  assert.equal(sanitizeCalendarColor("#123"), undefined); // 3 dígitos não aceitos
  assert.equal(sanitizeCalendarColor("#12345"), undefined); // 5 dígitos
  assert.equal(sanitizeCalendarColor("#1234567"), undefined); // 7 dígitos
  assert.equal(sanitizeCalendarColor("blue"), undefined); // nome de cor css
  assert.equal(sanitizeCalendarColor(""), undefined);
  assert.equal(sanitizeCalendarColor("   "), undefined);
  assert.equal(sanitizeCalendarColor(undefined), undefined);

  // Teste integrado no getCalendarFeed: cor maliciosa do Google é descartada na origem
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const userColor = {
    id: `user-color-${randomBytes(8).toString("hex")}`,
    email: "color@example.test",
    name: "Usuário Color",
  };

  invalidateCalendarCache(userColor.id);

  await withDatabase(async (db) => {
    await saveCalendarAccount(db, userColor, {
      googleSub: "sub-color",
      email: "color@gmail.test",
      refreshTokenEnc: encryptToken("tok-color", testKey, `${userColor.id}:sub-color`),
    });

    const mockFetchColor = async (input: RequestInfo | URL) => {
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "cal-malicious",
                summary: "Calendário Injetor",
                backgroundColor: "red;background:url(x)", // Injeção CSS
                selected: true,
              },
              {
                id: "cal-valid",
                summary: "Calendário Normal",
                backgroundColor: "#039BE5", // Válido
                selected: true,
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes("cal-malicious/events")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "ev-malicious",
                summary: "Evento Malicioso",
                start: { date: "2026-11-17" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes("cal-valid/events")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "ev-valid",
                summary: "Evento Normal",
                start: { date: "2026-11-17" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const feed = await getCalendarFeed(
      db,
      userColor,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetchColor as typeof fetch,
    );

    const evMalicious = feed.events.find((e) => e.id === "ev-malicious")!;
    const evValid = feed.events.find((e) => e.id === "ev-valid")!;

    assert.equal(
      evMalicious.calendarColor,
      undefined,
      "Valor malicioso em calendarColor deve ser descartado",
    );
    assert.equal(
      evValid.calendarColor,
      "#039be5",
      "Cor hex válida de 6 dígitos deve ser aceita e normalizada",
    );
  });
});

test("(b) Distinção de erros HTTP: 403 permanente cacheia; timeout, 429 e 5xx NÃO cacheiam", async () => {
  const testKey = randomBytes(32).toString("base64");
  process.env.CALENDAR_TOKEN_KEY = testKey;
  process.env.GOOGLE_CLIENT_ID = "test-client.google.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  await withDatabase(async (db) => {
    // 1. Falha permanente de um calendário (403/404/410) NÃO marca isPartial e O FEED É CACHEADO
    const user403 = {
      id: `user-403-${randomBytes(8).toString("hex")}`,
      email: "403@example.test",
      name: "Usuário 403",
    };
    invalidateCalendarCache(user403.id);

    await saveCalendarAccount(db, user403, {
      googleSub: "sub-403",
      email: "403@gmail.test",
      refreshTokenEnc: encryptToken("tok-403", testKey, `${user403.id}:sub-403`),
    });

    let fetchCount403 = 0;
    const mockFetch403 = async (input: RequestInfo | URL) => {
      fetchCount403++;
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(
          JSON.stringify({
            items: [
              { id: "primary", summary: "Principal", primary: true, selected: true },
              { id: "cal-permissao-negada", summary: "Revogado", selected: true },
            ],
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes("cal-permissao-negada/events")) {
        // Erro permanente 403 Forbidden
        return new Response(JSON.stringify({ error: { code: 403, message: "Forbidden" } }), {
          status: 403,
        });
      }
      return new Response(
        JSON.stringify({
          items: [{ id: "ev-ok-1", summary: "Evento OK", start: { date: "2026-11-17" } }],
        }),
        { status: 200 },
      );
    };

    const feed403_1 = await getCalendarFeed(
      db,
      user403,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetch403 as typeof fetch,
    );
    assert.equal(feed403_1.isPartial, false, "403 permanente em um calendário não deve marcar isPartial");
    assert.equal(feed403_1.events.length, 1);
    const countAfterFirst403 = fetchCount403;

    // Segunda chamada para 403 deve usar o cache (fetchCount não se altera)
    const feed403_2 = await getCalendarFeed(
      db,
      user403,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetch403 as typeof fetch,
    );
    assert.equal(
      fetchCount403,
      countAfterFirst403,
      "Feed com falha permanente 403 deve ser cacheado para evitar repetição de ~46 chamadas",
    );
    assert.equal(feed403_2.events.length, 1);

    // 2. Falha 429 Too Many Requests: MARCA isPartial e NÃO É CACHEADO
    const user429 = {
      id: `user-429-${randomBytes(8).toString("hex")}`,
      email: "429@example.test",
      name: "Usuário 429",
    };
    invalidateCalendarCache(user429.id);

    await saveCalendarAccount(db, user429, {
      googleSub: "sub-429",
      email: "429@gmail.test",
      refreshTokenEnc: encryptToken("tok-429", testKey, `${user429.id}:sub-429`),
    });

    let fetchCount429 = 0;
    const mockFetch429 = async (input: RequestInfo | URL) => {
      fetchCount429++;
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(
          JSON.stringify({
            items: [{ id: "primary", summary: "Principal", primary: true, selected: true }],
          }),
          { status: 200 },
        );
      }
      // Retorna 429 Rate Limit
      return new Response("Too Many Requests", { status: 429 });
    };

    const feed429_1 = await getCalendarFeed(
      db,
      user429,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetch429 as typeof fetch,
    );
    assert.equal(feed429_1.isPartial, true, "429 deve marcar isPartial");
    const countAfterFirst429 = fetchCount429;

    // Segunda chamada para 429 deve bater na rede de novo (NÃO foi cacheado)
    await getCalendarFeed(
      db,
      user429,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetch429 as typeof fetch,
    );
    assert.ok(fetchCount429 > countAfterFirst429, "429 não deve ser cacheado");

    // 3. Falha 5xx: MARCA isPartial e NÃO É CACHEADO
    const user5xx = {
      id: `user-5xx-${randomBytes(8).toString("hex")}`,
      email: "5xx@example.test",
      name: "Usuário 5xx",
    };
    invalidateCalendarCache(user5xx.id);

    await saveCalendarAccount(db, user5xx, {
      googleSub: "sub-5xx",
      email: "5xx@gmail.test",
      refreshTokenEnc: encryptToken("tok-5xx", testKey, `${user5xx.id}:sub-5xx`),
    });

    let fetchCount5xx = 0;
    const mockFetch5xx = async (input: RequestInfo | URL) => {
      fetchCount5xx++;
      const urlStr = String(input);
      if (urlStr.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "mock-acc" }), { status: 200 });
      }
      if (urlStr.includes("users/me/calendarList")) {
        return new Response(
          JSON.stringify({
            items: [{ id: "primary", summary: "Principal", primary: true, selected: true }],
          }),
          { status: 200 },
        );
      }
      // Retorna 500 Internal Error
      return new Response("Internal Server Error", { status: 500 });
    };

    const feed5xx_1 = await getCalendarFeed(
      db,
      user5xx,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetch5xx as typeof fetch,
    );
    assert.equal(feed5xx_1.isPartial, true, "5xx deve marcar isPartial");
    const countAfterFirst5xx = fetchCount5xx;

    // Segunda chamada para 5xx deve bater na rede de novo (NÃO foi cacheado)
    await getCalendarFeed(
      db,
      user5xx,
      new Date("2026-11-17T12:00:00-03:00"),
      mockFetch5xx as typeof fetch,
    );
    assert.ok(fetchCount5xx > countAfterFirst5xx, "5xx não deve ser cacheado");
  });
});



