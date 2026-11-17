import { isCalendarCryptoConfigured } from "./crypto";

export interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  appUrl: string;
  isAvailable: boolean;
}

export function getCalendarConfig(env: NodeJS.ProcessEnv = process.env): CalendarConfig {
  const clientId = (env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET ?? "").trim();
  const rawAppUrl = (env.APP_URL ?? "").trim();

  // Em produção/Vercel ou fallback local:
  const appUrl = rawAppUrl || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

  const hasCrypto = isCalendarCryptoConfigured(env.CALENDAR_TOKEN_KEY);
  const isAvailable = Boolean(clientId && clientSecret && hasCrypto);

  return {
    clientId,
    clientSecret,
    appUrl,
    isAvailable,
  };
}

export function getRedirectUri(origin?: string, env: NodeJS.ProcessEnv = process.env): string {
  const config = getCalendarConfig(env);
  const base = origin && !config.appUrl ? origin : config.appUrl;
  return `${base.replace(/\/+$/, "")}/api/calendar/callback`;
}
