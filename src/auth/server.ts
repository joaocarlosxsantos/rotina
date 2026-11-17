import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabase } from "../db/client";
import { authMode, routeRedirect, type CurrentUser, type AuthAdapter } from "./contracts";

export async function getAuthAdapter(): Promise<AuthAdapter> {
  if (authMode() === "neon") {
    const { neonAdapter } = await import("./neon");
    return neonAdapter();
  }
  const { localAdapter, LOCAL_COOKIE, LOCAL_COOKIE_OPTIONS } = await import("./local");
  const jar = await cookies();
  return localAdapter(await getDatabase(), {
    get: () => jar.get(LOCAL_COOKIE)?.value,
    set: (token) => jar.set(LOCAL_COOKIE, token, LOCAL_COOKIE_OPTIONS),
    clear: () => jar.set(LOCAL_COOKIE, "", { ...LOCAL_COOKIE_OPTIONS, maxAge: 0 }),
  });
}
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getAuthAdapter()).getCurrentUser();
}
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}
export async function redirectAuthenticated(path: "/entrar" | "/criar-conta") {
  const target = routeRedirect(path, await getCurrentUser());
  if (target) redirect(target);
}
