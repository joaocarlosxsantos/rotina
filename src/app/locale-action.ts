"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { authMode } from "../auth/contracts";
import { LOCALE_COOKIE, parseLocale } from "../lib/i18n";

export async function setLocaleAction(formData: FormData) {
  const nextLocale = parseLocale(formData.get("locale"));
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, nextLocale, {
    httpOnly: true,
    secure: authMode() === "neon",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
