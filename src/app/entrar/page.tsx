import { redirectAuthenticated } from "../../auth/server";
import { AuthPage } from "../auth-page";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Entrar — Rotina Pet" };
export default async function SignIn({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await redirectAuthenticated("/entrar");
  return <AuthPage notice={(await searchParams).status === "confira-email"} />;
}
