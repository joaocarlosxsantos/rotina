"use server";

import { redirect } from "next/navigation";
import { getAuthAdapter, getCurrentUser } from "../auth/server";
import { AuthError } from "../auth/contracts";

export type AuthState = { error?: string; email?: string; name?: string };
export async function authenticate(kind: "signin" | "signup", _state: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").slice(0, 255);
  const name = String(form.get("name") ?? "").slice(0, 81);
  try {
    const auth = await getAuthAdapter();
    const input = { email, name, password: String(form.get("password") ?? "") };
    if (kind === "signin") await auth.signIn(input);
    else await auth.signUp(input);
  } catch (cause) {
    return { error: cause instanceof AuthError ? cause.message : "Não foi possível acessar agora. Tente novamente mais tarde.", email, name };
  }
  if (kind === "signup" && !await getCurrentUser()) redirect("/entrar?status=confira-email");
  redirect("/");
}
export async function signOut() {
  try { await (await getAuthAdapter()).signOut(); }
  catch { redirect("/?error=Não%20foi%20possível%20sair.%20Tente%20novamente."); }
  redirect("/entrar");
}
