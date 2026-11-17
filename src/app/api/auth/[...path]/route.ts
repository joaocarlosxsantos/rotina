import { NextRequest, NextResponse } from "next/server";
import { authMode } from "../../../../auth/contracts";
import { getNeonAuth } from "../../../../auth/neon";

export const runtime = "nodejs";
const allowed = new Set(["get-session", "sign-in/email", "sign-up/email", "sign-out"]);
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (authMode() !== "neon") return NextResponse.json({ error: "Indisponível." }, { status: 404 });
  const path = (await context.params).path.join("/");
  if (!allowed.has(path) || (request.method === "GET" && path !== "get-session")) return NextResponse.json({ error: "Indisponível." }, { status: 404 });
  if (request.method === "POST" && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Solicitação recusada." }, { status: 403 });
  try {
    const handlers = getNeonAuth().handler();
    const response = await (request.method === "GET" ? handlers.GET : handlers.POST)(request, context);
    if (response.status >= 400) return NextResponse.json({ error: "Não foi possível acessar. Tente novamente." }, { status: response.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Autenticação indisponível." }, { status: 503 });
  }
}
export const GET = handle;
export const POST = handle;
