"use server";

import { redirect } from "next/navigation";
import { getAuthAdapter, getCurrentUser } from "../auth/server";
import { AuthError } from "../auth/contracts";
import { getDictionary, localizeErrorMessage } from "../lib/i18n";
import { getLocale } from "../lib/i18n-server";

export type AuthState = { error?: string; email?: string; name?: string };

export async function authenticate(
  kind: "signin" | "signup",
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const locale = await getLocale();
  const t = getDictionary(locale).serverMessages;
  const email = String(form.get("email") ?? "").slice(0, 255);
  const name = String(form.get("name") ?? "").slice(0, 81);
  try {
    const auth = await getAuthAdapter();
    const input = { email, name, password: String(form.get("password") ?? "") };
    if (kind === "signin") await auth.signIn(input);
    else await auth.signUp(input);
  } catch (cause) {
    return {
      error:
        cause instanceof AuthError
          ? localizeErrorMessage(cause.message, locale)
          : t.genericAuthError,
      email,
      name,
    };
  }
  if (kind === "signup" && !(await getCurrentUser())) {
    redirect("/entrar?status=confira-email");
  }
  redirect("/");
}

export async function signOut() {
  const locale = await getLocale();
  const t = getDictionary(locale).serverMessages;
  try {
    await (await getAuthAdapter()).signOut();
  } catch {
    redirect(`/?error=${encodeURIComponent(t.signOutError)}`);
  }
  redirect("/entrar");
}
