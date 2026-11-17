import { isCalendarCryptoConfigured } from "./crypto";

export interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  appUrl: string;
  isAvailable: boolean;
}

export function getCalendarConfig(env: Partial<NodeJS.ProcessEnv> = process.env): CalendarConfig {
  const clientId = (env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET ?? "").trim();
  const rawAppUrl = (env.APP_URL ?? "").trim();
  const isProduction = env.NODE_ENV === "production" || Boolean(env.VERCEL);

  // Em produção/Vercel: obrigatoriamente APP_URL ou VERCEL_PROJECT_PRODUCTION_URL.
  // Sem isso em produção, não faz fallback para localhost e marca como indisponível.
  let appUrl = rawAppUrl;
  if (!appUrl && env.VERCEL_PROJECT_PRODUCTION_URL) {
    appUrl = `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  } else if (!appUrl && !isProduction) {
    appUrl = "http://localhost:3000";
  }

  const hasCrypto = isCalendarCryptoConfigured(env.CALENDAR_TOKEN_KEY);
  const isAvailable = Boolean(clientId && clientSecret && hasCrypto && appUrl);

  return {
    clientId,
    clientSecret,
    appUrl,
    isAvailable,
  };
}

export function getRedirectUri(origin?: string, env: Partial<NodeJS.ProcessEnv> = process.env): string {
  const config = getCalendarConfig(env);
  const base = config.appUrl || origin || "";
  return `${base.replace(/\/+$/, "")}/api/calendar/callback`;
}
