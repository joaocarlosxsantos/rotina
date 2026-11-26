import { NextRequest, NextResponse } from "next/server";
import { authMode } from "./auth/contracts";
import { getNeonAuth } from "./auth/neon";

const PUBLIC_ASSET_REGEX =
  /^\/(favicon\.ico|icon\.svg|apple-icon\.png|manifest\.webmanifest|icon-[^/]+\.png|(opengraph|twitter)-image.*|robots\.txt|sitemap\.xml)$/;

export function isPublicAsset(pathname: string): boolean {
  return PUBLIC_ASSET_REGEX.test(pathname);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isPublicAsset(pathname)) return NextResponse.next();
  // Local: páginas e ações validam sessão no adaptador PGlite. Nenhum fetch de Auth.
  if (authMode() === "local") return NextResponse.next();
  try {
    return await getNeonAuth().middleware({
      loginUrl: "/entrar",
      publicRoutes: [
        "/",
        "/entrar",
        "/criar-conta",
        "/favicon.ico",
        "/icon.svg",
        "/apple-icon.png",
        "/manifest.webmanifest",
        "/robots.txt",
        "/sitemap.xml",
      ],
    })(request);
  } catch {
    return new NextResponse("Autenticação indisponível. Tente novamente mais tarde.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png|manifest\\.webmanifest|icon-.*\\.png|opengraph-image.*|twitter-image.*|robots\\.txt|sitemap\\.xml).*)",
  ],
};
