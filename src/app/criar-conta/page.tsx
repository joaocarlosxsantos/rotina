import { redirectAuthenticated } from "../../auth/server";
import { AuthPage } from "../auth-page";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = { title: "Criar conta — Rotina Pet" };
export default async function SignUp() {
  await redirectAuthenticated("/criar-conta");
  return <AuthPage signup />;
}
