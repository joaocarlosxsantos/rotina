import { NextRequest, NextResponse } from "next/server";
import { type CurrentUser } from "../../../../auth/contracts";
import { requireCurrentUser } from "../../../../auth/server";
import { getCalendarConfig, getRedirectUri } from "../../../../lib/calendar/config";
import {
  buildGoogleAuthUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from "../../../../lib/calendar/oauth";

export const dynamic = "force-dynamic";

export async function handleConnect(_request: NextRequest, userOverride?: CurrentUser) {
  const config = getCalendarConfig();
  const baseUrl = config.appUrl || "http://localhost:3000";

  let user = userOverride;
  if (!user) {
    try {
      user = await requireCurrentUser();
    } catch {
      const loginUrl = new URL("/entrar", baseUrl);
      const res = NextResponse.redirect(loginUrl);
      res.headers.set("Referrer-Policy", "no-referrer");
      return res;
    }
  }

  if (!config.isAvailable) {
    const redirectUrl = new URL("/calendario?error=unconfigured", baseUrl);
    const res = NextResponse.redirect(redirectUrl);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  const state = generateOAuthState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const redirectUri = getRedirectUri();
  const authUrl = buildGoogleAuthUrl({
    clientId: config.clientId,
    redirectUri,
    state,
    codeChallenge,
  });

  const response = NextResponse.redirect(authUrl);
  response.headers.set("Referrer-Policy", "no-referrer");

  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  // Cookie de segurança __Host-gcal_oauth com vínculo de sessão e PKCE (B1, B2)
  response.cookies.set(
    "__Host-gcal_oauth",
    JSON.stringify({ state, codeVerifier, userId: user.id }),
    {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 60 * 15,
      path: "/",
    },
  );

  return response;
}

export async function GET(request: NextRequest) {
  return handleConnect(request);
}
