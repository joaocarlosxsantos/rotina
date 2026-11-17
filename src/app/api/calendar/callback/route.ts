import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "../../../../auth/server";
import { getDatabase } from "../../../../db/client";
import { getCalendarConfig, getRedirectUri } from "../../../../lib/calendar/config";
import { encryptToken } from "../../../../lib/calendar/crypto";
import { exchangeCodeForTokens, GoogleOAuthError } from "../../../../lib/calendar/oauth";
import { saveCalendarAccount } from "../../../../lib/calendar/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    return NextResponse.redirect(new URL("/entrar", request.nextUrl.origin));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const googleError = searchParams.get("error");

  const oauthCookie = request.cookies.get("google_calendar_oauth")?.value;

  // Helper para redirecionamento com limpeza do cookie de oauth
  function failRedirect(message: string) {
    const res = NextResponse.redirect(
      new URL(`/calendario?error=${encodeURIComponent(message)}`, request.nextUrl.origin),
    );
    res.cookies.delete("google_calendar_oauth");
    return res;
  }

  if (googleError) {
    return failRedirect("A autorização foi cancelada ou recusada no Google.");
  }

  if (!oauthCookie || !state || !code) {
    return failRedirect("Sessão de autorização expirada ou inválida. Tente conectar novamente.");
  }

  let cookieData: { state: string; codeVerifier: string; userId?: string };
  try {
    cookieData = JSON.parse(oauthCookie);
  } catch {
    return failRedirect("Sessão de autorização corrompida. Tente novamente.");
  }

  // Validação estrita de state e vínculo de usuário
  if (cookieData.state !== state || (cookieData.userId && cookieData.userId !== user.id)) {
    return failRedirect("Falha na validação de segurança da autorização (state inválido).");
  }

  const config = getCalendarConfig();
  if (!config.isAvailable) {
    return failRedirect("Configuração do Google Calendar indisponível.");
  }

  const redirectUri = getRedirectUri(request.nextUrl.origin);

  try {
    const { tokens, profile } = await exchangeCodeForTokens({
      code,
      codeVerifier: cookieData.codeVerifier,
      redirectUri,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });

    if (!tokens.refreshToken) {
      return failRedirect(
        "O Google não forneceu permissão offline (refresh token). Conecte novamente e certifique-se de autorizar o acesso.",
      );
    }

    const refreshTokenEnc = encryptToken(tokens.refreshToken);
    const db = await getDatabase();

    await saveCalendarAccount(db, user, {
      googleSub: profile.sub,
      email: profile.email,
      refreshTokenEnc,
    });

    const res = NextResponse.redirect(
      new URL("/calendario?success=Conta+Google+conectada+com+sucesso!", request.nextUrl.origin),
    );
    res.cookies.delete("google_calendar_oauth");
    return res;
  } catch (error) {
    const message =
      error instanceof GoogleOAuthError
        ? error.message
        : "Ocorreu um erro ao processar a autorização da conta Google. Tente novamente.";

    return failRedirect(message);
  }
}
