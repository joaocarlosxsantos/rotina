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

  // N3: se appUrl estiver vazio ou recurso indisponível, responder com redirect relativo (sem host)
  if (!config.isAvailable || !config.appUrl) {
    return new NextResponse(null, {
      status: 307,
      headers: {
        Location: "/calendario?error=unconfigured",
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  let user = userOverride;
  if (!user) {
    try {
      user = await requireCurrentUser();
    } catch {
      const loginUrl = new URL("/entrar", config.appUrl);
      const res = NextResponse.redirect(loginUrl);
      res.headers.set("Referrer-Policy", "no-referrer");
      return res;
    }
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

  // B1: Cookie __Host-gcal_oauth com secure: true SEMPRE (localhost aceita Secure na RFC 6265bis)
  response.cookies.set(
    "__Host-gcal_oauth",
    JSON.stringify({ state, codeVerifier, userId: user.id }),
    {
      httpOnly: true,
      secure: true,
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
