import { createNeonAuth } from "@neon/auth/next/server";
import { ACCESS_ERROR, AuthError, credentials, type AuthAdapter } from "./contracts";

export function neonAuthConfig(env: Readonly<Record<string, string | undefined>> = process.env) {
  const baseUrl = env.NEON_AUTH_BASE_URL?.trim();
  const secret = env.NEON_AUTH_COOKIE_SECRET;
  try {
    const url = new URL(baseUrl ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !secret || secret.length < 32)
      throw new Error();
  } catch {
    throw new AuthError("Autenticação indisponível. Tente novamente mais tarde.");
  }
  return { baseUrl: baseUrl!, cookies: { secret: secret!, sameSite: "lax" as const, sessionDataTtl: 1 }, logLevel: "silent" as const };
}
let instance: ReturnType<typeof createNeonAuth> | undefined;
export function getNeonAuth() {
  return instance ??= createNeonAuth(neonAuthConfig());
}
export function neonAdapter(): AuthAdapter {
  return {
    async getCurrentUser() {
      try {
        // Sem cache de cookie: uma sessão revogada não deve autorizar outra ação.
        const { data, error } = await getNeonAuth().getSession({ query: { disableCookieCache: "true" } });
        if (error) return null;
        return data?.user ? { id: data.user.id, email: data.user.email, name: data.user.name } : null;
      } catch { return null; }
    },
    async signIn(input) {
      const valid = credentials(input);
      try {
        const { error } = await getNeonAuth().signIn.email(valid);
        if (error) throw new Error();
      } catch { throw new AuthError(ACCESS_ERROR); }
    },
    async signUp(input) {
      const valid = credentials(input, true);
      try {
        const { error } = await getNeonAuth().signUp.email({ ...valid, name: valid.name! });
        if (error) throw new Error();
      } catch { throw new AuthError("Não foi possível criar a conta. Confira os dados ou tente entrar se já possui cadastro."); }
    },
    async signOut() {
      try {
        const { error } = await getNeonAuth().signOut();
        if (error) throw new Error();
      } catch { throw new AuthError("Não foi possível sair. Tente novamente."); }
    },
  };
}
