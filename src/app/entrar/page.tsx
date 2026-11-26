import type { Metadata } from "next";
import { redirectAuthenticated } from "../../auth/server";
import { getDictionary } from "../../lib/i18n";
import { getLocale } from "../../lib/i18n-server";
import { AuthPage } from "../auth-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDictionary(locale).meta.signInTitle };
}

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await redirectAuthenticated("/entrar");
  const locale = await getLocale();
  return (
    <AuthPage
      notice={(await searchParams).status === "confira-email"}
      locale={locale}
    />
  );
}
