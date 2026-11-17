import { NextRequest, NextResponse } from "next/server";
import { type CurrentUser } from "../../../../auth/contracts";
import { requireCurrentUser } from "../../../../auth/server";
import { getDatabase } from "../../../../db/client";
import { getCalendarConfig, getRedirectUri } from "../../../../lib/calendar/config";
import { encryptToken } from "../../../../lib/calendar/crypto";
import {
  exchangeCodeForTokens,
  GoogleEmailUnverifiedError,
  GoogleNoOfflineAccessError,
  timingSafeStringEqual,
} from "../../../../lib/calendar/oauth";
import { CalendarAccountLimitError, saveCalendarAccount } from "../../../../lib/calendar/store";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE_NAME = "__Host-gcal_oauth";

export async function handleCallback(
  request: NextRequest,
  userOverride?: CurrentUser,
  fetchFn = fetch,
) {
  const config = getCalendarConfig();

  // Helper central para redirecionamento seguro com eliminação do cookie e Referrer-Policy (B1, B4, M2, N3)
  function makeRedirect(path: string) {
    const res = config.appUrl
      ? NextResponse.redirect(new URL(path, config.appUrl))
      : new NextResponse(null, {
          status: 307,
          headers: { Location: path },
        });

    res.headers.set("Referrer-Policy", "no-referrer");
    res.cookies.set(OAUTH_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true, // B1: secure: true SEMPRE
      sameSite: "lax",
    });
    return res;
  }

  function failRedirect(codeKey: string) {
    return makeRedirect(`/calendario?error=${encodeURIComponent(codeKey)}`);
  }

  // N3: se appUrl estiver vazio ou recurso indisponível, responder com redirect relativo (sem host)
  if (!config.isAvailable || !config.appUrl) {
    return failRedirect("unconfigured");
  }

  let user = userOverride;
  if (!user) {
    try {
      user = await requireCurrentUser();
    } catch {
      return makeRedirect("/entrar");
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const googleError = searchParams.get("error");

  const oauthCookie = request.cookies.get(OAUTH_COOKIE_NAME)?.value;

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
    // Classificação estritamente por classe / código tipado (sem checagem de substring)
    if (error instanceof CalendarAccountLimitError) {
      return failRedirect("account_limit");
    }
    if (error instanceof GoogleEmailUnverifiedError) {
      return failRedirect("email_unverified");
    }
    if (error instanceof GoogleNoOfflineAccessError) {
      return failRedirect("no_offline_access");
    }

    // Log seguro: apenas operação e nome da classe do erro (sem mensagem de provedor nem corpo)
    const errorClassName = error instanceof Error ? error.constructor.name : typeof error;
    console.error(`Erro ao salvar conta Google: operacao=save_calendar_account, classe=${errorClassName}`);

    return failRedirect("auth_failed");
  }
}

export async function GET(request: NextRequest) {
  return handleCallback(request);
}
