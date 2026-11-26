export type CurrentUser = Readonly<{ id: string; email: string; name: string }>;
export type Credentials = { email: string; password: string; name?: string };
export interface AuthAdapter {
  getCurrentUser(): Promise<CurrentUser | null>;
  signIn(input: Credentials): Promise<void>;
  signUp(input: Credentials): Promise<void>;
  signOut(): Promise<void>;
}
export class AuthError extends Error {}
export const ACCESS_ERROR = "Não foi possível acessar. Confira os dados e tente novamente.";
export function authenticatedId(user: CurrentUser | null | undefined): string {
  if (!user || typeof user.id !== "string" || !user.id || user.id.length > 200)
    throw new AuthError("Sessão necessária.");
  return user.id;
}
export function authMode(env: Readonly<Record<string, string | undefined>> = process.env) {
  // Não há override de desenvolvimento que possa habilitar o adaptador local no deploy.
  return env.VERCEL !== undefined || env.NODE_ENV === "production" ? "neon" : "local";
}
export function credentials(input: Credentials, signup = false): Credentials {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AuthError("Informe um e-mail válido.");
  if (password.length < 8 || password.length > 128)
    throw new AuthError("A senha deve ter de 8 a 128 caracteres.");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (signup && (name.length < 2 || name.length > 80))
    throw new AuthError("O nome deve ter de 2 a 80 caracteres.");
  return { email, password, ...(signup ? { name } : {}) };
}
export function routeRedirect(path: string, user: CurrentUser | null) {
  const authPage = path === "/entrar" || path === "/criar-conta";
  const publicPage = path === "/" || authPage;
  if (!user && !publicPage) return "/entrar";
  if (user && authPage) return "/";
  return null;
}
