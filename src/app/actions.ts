"use server";

import { requireCurrentUser } from "../auth/server";
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
  setUserPet,
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
        : "Não foi possível salvar. Tente novamente mais tarde.";
    if (!(cause instanceof InputError))
      console.error("Falha ao processar a ação.");
  }
  if (error) redirect(`${destination}?error=${encodeURIComponent(error)}`);
  revalidatePath("/");
  revalidatePath("/rotinas");
  revalidatePath("/pets");
  redirect(`${destination}?success=${encodeURIComponent(success)}`);
}

function destination(form: FormData) {
  return form.get("returnTo") === "/rotinas" ? "/rotinas" : "/";
}

export async function createRoutine(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () =>
      addRoutine(await getDatabase(), user, form.get("name"), form.getAll("days")),
    "Rotina criada. Agora adicione suas atividades.",
    destination(form),
  );
}
export async function createActivity(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () =>
      addActivity(
        await getDatabase(), user,
        form.get("routineId"),
        form.get("name"),
        form.get("time"),
      ),
    "Atividade adicionada à sua rotina.",
    destination(form),
  );
}

export async function editRoutine(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () =>
      updateRoutine(
        await getDatabase(), user,
        form.get("routineId"),
        form.get("name"),
        form.getAll("days"),
      ),
    "Rotina atualizada.",
    destination(form),
  );
}

export async function editActivity(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () =>
      updateActivity(
        await getDatabase(), user,
        form.get("activityId"),
        form.get("name"),
        form.get("time"),
      ),
    "Atividade atualizada.",
    destination(form),
  );
}

export async function hideRoutine(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () => archiveRoutine(await getDatabase(), user, form.get("routineId")),
    "Rotina arquivada. Histórico e pontos preservados.",
    destination(form),
  );
}

export async function hideActivity(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () => archiveActivity(await getDatabase(), user, form.get("activityId")),
    "Atividade arquivada. Histórico e pontos preservados.",
    destination(form),
  );
}
export async function finishActivity(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () => completeActivity(await getDatabase(), user, form.get("activityId")),
    completionMessage,
  );
}

export async function passActivity(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () => skipActivity(await getDatabase(), user, form.get("activityId")),
    skipMessage,
  );
}

export async function selectPet(form: FormData) {
  const user = await requireCurrentUser();
  const petKind = form.get("petKind");
  await mutate(
    async () => setUserPet(await getDatabase(), user, petKind),
    "Companheiro atualizado com sucesso!",
    "/pets",
  );
}
