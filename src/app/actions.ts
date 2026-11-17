"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDatabase } from "../db/client";
import { addActivity, addRoutine, completeActivity } from "../lib/store";
import { completionMessage, InputError } from "../lib/rules";

async function mutate<T>(
  work: () => Promise<T>,
  message: string | ((result: T) => string),
) {
  let error: string | undefined;
  let success = "";
  try {
    const result = await work();
    success = typeof message === "function" ? message(result) : message;
  } catch (cause) {
    error =
      cause instanceof InputError
        ? cause.message
        : "Não foi possível salvar. Confira o banco local e tente novamente.";
    if (!(cause instanceof InputError))
      console.error("Falha ao salvar no SQLite local.");
  }
  if (error) redirect(`/?error=${encodeURIComponent(error)}`);
  revalidatePath("/");
  redirect(`/?success=${encodeURIComponent(success)}`);
}

export async function createRoutine(form: FormData) {
  await mutate(
    () => addRoutine(getDatabase(), form.get("name")),
    "Rotina criada. Agora adicione suas atividades.",
  );
}
export async function createActivity(form: FormData) {
  await mutate(
    () => addActivity(getDatabase(), form.get("routineId"), form.get("name")),
    "Atividade adicionada à sua rotina.",
  );
}
export async function finishActivity(form: FormData) {
  await mutate(
    () => completeActivity(getDatabase(), form.get("activityId")),
    completionMessage,
  );
}
