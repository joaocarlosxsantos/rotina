"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDatabase } from "../db/client";
import {
  addActivity,
  addRoutine,
  completeActivity,
  skipActivity,
  updateRoutine,
  updateActivity,
  archiveRoutine,
  archiveActivity,
} from "../lib/store";
import { completionMessage, InputError, skipMessage } from "../lib/rules";

async function mutate<T>(
  work: () => Promise<T>,
  message: string | ((result: T) => string),
  destination = "/",
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
      console.error("Falha ao salvar no banco.");
  }
  if (error) redirect(`${destination}?error=${encodeURIComponent(error)}`);
  revalidatePath("/");
  revalidatePath("/rotinas");
  redirect(`${destination}?success=${encodeURIComponent(success)}`);
}

function destination(form: FormData) {
  return form.get("returnTo") === "/rotinas" ? "/rotinas" : "/";
}

export async function createRoutine(form: FormData) {
  await mutate(
    async () =>
      addRoutine(await getDatabase(), form.get("name"), form.getAll("days")),
    "Rotina criada. Agora adicione suas atividades.",
    destination(form),
  );
}
export async function createActivity(form: FormData) {
  await mutate(
    async () =>
      addActivity(
        await getDatabase(),
        form.get("routineId"),
        form.get("name"),
        form.get("time"),
      ),
    "Atividade adicionada à sua rotina.",
    destination(form),
  );
}

export async function editRoutine(form: FormData) {
  await mutate(
    async () =>
      updateRoutine(
        await getDatabase(),
        form.get("routineId"),
        form.get("name"),
        form.getAll("days"),
      ),
    "Rotina atualizada.",
    destination(form),
  );
}

export async function editActivity(form: FormData) {
  await mutate(
    async () =>
      updateActivity(
        await getDatabase(),
        form.get("activityId"),
        form.get("name"),
        form.get("time"),
      ),
    "Atividade atualizada.",
    destination(form),
  );
}

export async function hideRoutine(form: FormData) {
  await mutate(
    async () => archiveRoutine(await getDatabase(), form.get("routineId")),
    "Rotina arquivada. Histórico e pontos preservados.",
    destination(form),
  );
}

export async function hideActivity(form: FormData) {
  await mutate(
    async () => archiveActivity(await getDatabase(), form.get("activityId")),
    "Atividade arquivada. Histórico e pontos preservados.",
    destination(form),
  );
}
export async function finishActivity(form: FormData) {
  await mutate(
    async () => completeActivity(await getDatabase(), form.get("activityId")),
    completionMessage,
  );
}

export async function passActivity(form: FormData) {
  await mutate(
    async () => skipActivity(await getDatabase(), form.get("activityId")),
    skipMessage,
  );
}
