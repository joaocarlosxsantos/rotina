import { NextRequest, NextResponse } from "next/server";
import { type CurrentUser } from "../../../../auth/contracts";
import { requireCurrentUser } from "../../../../auth/server";
import { getDatabase } from "../../../../db/client";
import { getCalendarConfig, getRedirectUri } from "../../../../lib/calendar/config";
import { encryptToken } from "../../../../lib/calendar/crypto";
import { exchangeCodeForTokens, GoogleOAuthError, timingSafeStringEqual } from "../../../../lib/calendar/oauth";
import { saveCalendarAccount } from "../../../../lib/calendar/store";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE_NAME = "__Host-gcal_oauth";

export async function handleCallback(
  request: NextRequest,
  userOverride?: CurrentUser,
  fetchFn = fetch,
) {
  const config = getCalendarConfig();
  const baseUrl = config.appUrl || "http://localhost:3000";
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  let user = userOverride;
  if (!user) {
    try {
      user = await requireCurrentUser();
    } catch {
      const res = NextResponse.redirect(new URL("/entrar", baseUrl));
      res.headers.set("Referrer-Policy", "no-referrer");
      return res;
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const googleError = searchParams.get("error");

  const oauthCookie = request.cookies.get(OAUTH_COOKIE_NAME)?.value;

  // Helper central para redirecionamento seguro com eliminação do cookie e Referrer-Policy (B1, B4, M2)
  function makeRedirect(path: string) {
    const res = NextResponse.redirect(new URL(path, baseUrl));
    res.headers.set("Referrer-Policy", "no-referrer");
    res.cookies.set(OAUTH_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    });
    return res;
  }

  function failRedirect(codeKey: string) {
    return makeRedirect(`/calendario?error=${encodeURIComponent(codeKey)}`);
  }

  if (googleError) {
    return failRedirect("access_denied");
  }

  if (!oauthCookie || !state || !code) {
    return failRedirect("missing_params");
  }

  let cookieData: { state?: string; codeVerifier?: string; userId?: string };
  try {
    cookieData = JSON.parse(oauthCookie);
  } catch {
    return failRedirect("invalid_session");
  }

  // Validação estrita de vínculo de sessão: cookie deve ter userId e bater exatamente com o usuário logado (B2)
  if (!cookieData.userId || cookieData.userId !== user.id) {
    return failRedirect("user_mismatch");
  }

  // Validação de state resistente a timing attacks (M1)
  if (!cookieData.state || !timingSafeStringEqual(cookieData.state, state)) {
    return failRedirect("invalid_state");
  }

  if (!cookieData.codeVerifier) {
    return failRedirect("invalid_session");
  }

  if (!config.isAvailable) {
    return failRedirect("unconfigured");
  }

  const redirectUri = getRedirectUri();

  try {
    const { tokens, profile } = await exchangeCodeForTokens({
      code,
      codeVerifier: cookieData.codeVerifier,
      redirectUri,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      fetchFn,
    });

    if (!tokens.refreshToken) {
      return failRedirect("no_offline_access");
    }

    // Criptografia AES-256-GCM com vinculação de contexto AAD (I1: user_id + google_sub)
    const aad = `${user.id}:${profile.sub}`;
    const refreshTokenEnc = encryptToken(tokens.refreshToken, undefined, aad);
    const db = await getDatabase();

    await saveCalendarAccount(db, user, {
      googleSub: profile.sub,
      email: profile.email,
      refreshTokenEnc,
    });

    return makeRedirect("/calendario?success=connected");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "";

    if (errorMsg.includes("Limite máximo de 5 contas")) {
      return failRedirect("account_limit");
    }
    if (errorMsg.includes("não está verificado")) {
      return failRedirect("email_unverified");
    }
    if (errorMsg.includes("atualização offline")) {
      return failRedirect("no_offline_access");
    }

    return failRedirect("auth_failed");
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}
