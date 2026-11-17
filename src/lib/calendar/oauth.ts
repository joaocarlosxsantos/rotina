import { createHash, randomBytes } from "node:crypto";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export class GoogleOAuthError extends Error {
  readonly isInvalidGrant: boolean;

  constructor(message: string, isInvalidGrant = false) {
    super(message);
    this.name = "GoogleOAuthError";
    this.isInvalidGrant = isInvalidGrant;
  }
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

export function buildGoogleAuthUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: "offline",
    prompt: "consent select_account",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleTokenResponse {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
}

export interface GoogleUserProfile {
  sub: string;
  email: string;
}

/**
 * Decodifica o payload do id_token JWT sem depender de bibliotecas externas.
 */
export function decodeIdToken(idToken: string): GoogleUserProfile {
  try {
    const parts = idToken.split(".");
    if (parts.length < 2 || !parts[1]) {
      throw new Error("Token JWT malformado.");
    }
    const jsonStr = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(jsonStr) as { sub?: string; email?: string };
    if (!payload.sub || !payload.email) {
      throw new Error("Payload do ID token sem sub ou email.");
    }
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
    };
  } catch {
    throw new GoogleOAuthError("Não foi possível identificar a conta Google (ID token inválido).");
  }
}

/**
 * Troca o código de autorização e code_verifier pelo conjunto de tokens do Google.
 */
export async function exchangeCodeForTokens({
  code,
  codeVerifier,
  redirectUri,
  clientId,
  clientSecret,
  fetchFn = fetch,
}: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  fetchFn?: typeof fetch;
}): Promise<{
  tokens: GoogleTokenResponse;
  profile: GoogleUserProfile;
}> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  let res: Response;
  try {
    res = await fetchFn("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    console.error("Erro de rede ao comunicar com endpoint de token Google");
    throw new GoogleOAuthError("Falha de conexão com o Google. Tente novamente mais tarde.");
  }

  if (!res.ok) {
    // Log seguro: apenas operação e status HTTP, sem vazar segredos ou respostas
    console.error("Falha na troca de código OAuth Google: status", res.status);
    throw new GoogleOAuthError("Não foi possível conectar com o Google. Autorização recusada ou expirada.");
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new GoogleOAuthError("Resposta do Google incompleta (access_token ausente).");
  }

  if (!data.refresh_token) {
    throw new GoogleOAuthError(
      "O Google não forneceu permissão de atualização offline. Remova o acesso do app na sua conta Google e conecte novamente.",
    );
  }

  let profile: GoogleUserProfile;
  if (data.id_token) {
    profile = decodeIdToken(data.id_token);
  } else {
    // Fallback: consulta endpoint userinfo se id_token não veio
    try {
      const userinfoRes = await fetchFn("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (!userinfoRes.ok) throw new Error();
      const uData = (await userinfoRes.json()) as { sub?: string; email?: string };
      if (!uData.sub || !uData.email) throw new Error();
      profile = { sub: uData.sub, email: uData.email.toLowerCase() };
    } catch {
      throw new GoogleOAuthError("Não foi possível ler as informações de perfil da conta Google.");
    }
  }

  return {
    tokens: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      expiresIn: Number(data.expires_in ?? 3600),
    },
    profile,
  };
}

/**
 * Obtém um novo access_token a partir de um refresh_token armazenado.
 */
export async function refreshGoogleAccessToken({
  refreshToken,
  clientId,
  clientSecret,
  fetchFn = fetch,
}: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchFn?: typeof fetch;
}): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  let res: Response;
  try {
    res = await fetchFn("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    console.error("Erro de rede ao renovar token Google");
    throw new GoogleOAuthError("Falha de conexão ao renovar acesso com o Google.");
  }

  if (!res.ok) {
    console.error("Erro na renovação de token Google: status", res.status);
    let isInvalidGrant = false;
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson.error === "invalid_grant") {
        isInvalidGrant = true;
      }
    } catch {
      // ignore
    }
    throw new GoogleOAuthError(
      isInvalidGrant
        ? "Autorização da conta Google expirada ou revogada. Por favor, reconecte a conta."
        : "Não foi possível renovar o acesso à conta Google.",
      isInvalidGrant,
    );
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new GoogleOAuthError("Resposta de renovação sem access_token.");
  }

  return data.access_token;
}

/**
 * Tenta revogar o token no Google quando a conta é removida.
 */
export async function revokeGoogleToken({
  token,
  fetchFn = fetch,
}: {
  token: string;
  fetchFn?: typeof fetch;
}): Promise<void> {
  try {
    await fetchFn(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch {
    // Falha de revogação não impede a exclusão local
    console.error("Falha ao notificar revogação ao Google; prosseguindo com remoção local.");
  }
}
