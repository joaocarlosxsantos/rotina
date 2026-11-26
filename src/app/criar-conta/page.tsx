import type { Metadata } from "next";
import { redirectAuthenticated } from "../../auth/server";
import { getDictionary } from "../../lib/i18n";
import { getLocale } from "../../lib/i18n-server";
import { AuthPage } from "../auth-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDictionary(locale).meta.signUpTitle };
}

export default async function SignUp() {
  await redirectAuthenticated("/criar-conta");
  const locale = await getLocale();
  return <AuthPage signup locale={locale} />;
}
