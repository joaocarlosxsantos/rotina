import { createNeonAuth } from "@neon/auth/next/server";
import { ACCESS_ERROR, AuthError, credentials, type AuthAdapter } from "./contracts";

type AuthEnvironment = Readonly<Record<string, string | undefined>>;
type Operation = "signIn" | "signUp" | "signOut" | "getCurrentUser";
type ProviderError = { status?: unknown; code?: unknown; message?: unknown };
type SensitiveInput = { email?: string; password?: string };
const MAX_LOG_LENGTH = 200;

export function neonAuthConfig(env: AuthEnvironment = process.env) {
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
export type NeonAuthClient = ReturnType<typeof getNeonAuth>;

function redact(value: string, env: AuthEnvironment, input?: SensitiveInput): string {
  let text = value;
  const secret = env.NEON_AUTH_COOKIE_SECRET;
  if (secret) text = text.split(secret).join("[secret]");
  if (input?.email) text = text.split(input.email).join("[email]");
  if (input?.password) text = text.split(input.password).join("[password]");
  return text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>]+/gi, "[url]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]")
    .replace(/(authorization|set-cookie|cookie|token|secret|password|senha)\s*[:=]\s*[^\s,;]+/gi, "[redacted]")
    .slice(0, MAX_LOG_LENGTH);
}

function scalar(
  value: unknown,
  env: AuthEnvironment,
  input?: SensitiveInput,
): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  return redact(value, env, input);
}

function logProviderError(
  operation: Operation,
  error: unknown,
  env: AuthEnvironment,
  input?: SensitiveInput,
  extra?: Record<string, boolean>,
) {
  const source = (error && typeof error === "object" ? error : {}) as ProviderError;
  const payload: Record<string, unknown> = {
    operation,
    status: scalar(source.status, env, input),
    code: scalar(source.code, env, input),
    message: typeof source.message === "string" ? redact(source.message, env, input) : "",
    ...extra,
  };
  console.error(JSON.stringify(payload));
}

export function neonAdapter(
  client: NeonAuthClient = getNeonAuth(),
  env: AuthEnvironment = process.env,
): AuthAdapter {
  return {
    async getCurrentUser() {
      try {
        // Sem cache de cookie: uma sessão revogada não deve autorizar outra ação.
        const { data, error } = await client.getSession({ query: { disableCookieCache: "true" } });
        if (error) {
          logProviderError("getCurrentUser", error, env);
          return null;
        }
        return data?.user ? { id: data.user.id, email: data.user.email, name: data.user.name } : null;
      } catch { return null; }
    },
    async signIn(input) {
      const valid = credentials(input);
      try {
        const { error } = await client.signIn.email(valid);
        if (error) {
          logProviderError("signIn", error, env, input);
          throw new Error();
        }
      } catch { throw new AuthError(ACCESS_ERROR); }
    },
    async signUp(input) {
      const valid = credentials(input, true);
      try {
        const { error } = await client.signUp.email({ ...valid, name: valid.name! });
        if (error) {
          logProviderError("signUp", error, env, input, {
            baseUrlPresent: Boolean(env.NEON_AUTH_BASE_URL?.trim()),
            secretPresent: Boolean(env.NEON_AUTH_COOKIE_SECRET),
            secretLongEnough: (env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) >= 32,
          });
          throw new Error();
        }
      } catch { throw new AuthError("Não foi possível criar a conta. Confira os dados ou tente entrar se já possui cadastro."); }
    },
    async signOut() {
      try {
        const { error } = await client.signOut();
        if (error) {
          logProviderError("signOut", error, env);
          throw new Error();
        }
      } catch { throw new AuthError("Não foi possível sair. Tente novamente."); }
    },
  };
}
