"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentUser } from "../../auth/server";
import { getDatabase } from "../../db/client";
import { deleteCalendarAccount } from "../../lib/calendar/store";

export async function removeCalendarAccountAction(formData: FormData) {
  let user;
  try {
    user = await requireCurrentUser();
  } catch {
    redirect("/entrar");
  }

  const accountId = formData.get("accountId");
  if (typeof accountId !== "string" || !accountId.trim()) {
    redirect("/calendario?error=Identificador+de+conta+inv%C3%A1lido.");
  }

  try {
    const db = await getDatabase();
    await deleteCalendarAccount(db, user, accountId.trim());
  } catch {
    console.error("Falha ao remover conta de calendário");
    redirect("/calendario?error=N%C3%A3o+foi+poss%C3%ADvel+remover+a+conta.+Tente+novamente.");
  }

  revalidatePath("/calendario");
  redirect("/calendario?success=Conta+removida+com+sucesso.");
}
