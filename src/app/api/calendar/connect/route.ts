import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "../../../../auth/server";
import { getCalendarConfig, getRedirectUri } from "../../../../lib/calendar/config";
import {
  buildGoogleAuthUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from "../../../../lib/calendar/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    const loginUrl = new URL("/entrar", request.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  const config = getCalendarConfig();
  if (!config.isAvailable) {
    const redirectUrl = new URL("/calendario?error=Recurso+Google+Calendar+indispon%C3%ADvel+no+momento.", request.nextUrl.origin);
    return NextResponse.redirect(redirectUrl);
  }

  const state = generateOAuthState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const redirectUri = getRedirectUri(request.nextUrl.origin);
  const authUrl = buildGoogleAuthUrl({
    clientId: config.clientId,
    redirectUri,
    state,
    codeChallenge,
  });

  const response = NextResponse.redirect(authUrl);

  // Cookie seguro com estado e PKCE code_verifier (duração de 15 minutos)
  response.cookies.set("google_calendar_oauth", JSON.stringify({ state, codeVerifier, userId: user.id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15,
    path: "/",
  });

  return response;
}
