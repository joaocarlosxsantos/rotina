import { NextRequest, NextResponse } from "next/server";
import { authMode } from "./auth/contracts";
import { getNeonAuth } from "./auth/neon";

export async function proxy(request: NextRequest) {
  // Local: páginas e ações validam sessão no adaptador PGlite. Nenhum fetch de Auth.
  if (authMode() === "local") return NextResponse.next();
  try {
    return await getNeonAuth().middleware({ loginUrl: "/entrar", publicRoutes: ["/entrar", "/criar-conta"] })(request);
  } catch {
    return new NextResponse("Autenticação indisponível. Tente novamente mais tarde.", { status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
  }
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
