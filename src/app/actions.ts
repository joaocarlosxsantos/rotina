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
import {
  completionMessage,
  InputError,
  skipMessage,
  activityScheduleFromForm,
} from "../lib/rules";
import { getDictionary, localizeErrorMessage, type Locale } from "../lib/i18n";
import { getLocale } from "../lib/i18n-server";

async function mutate<T>(
  work: () => Promise<T>,
  message: string | ((result: T, locale: Locale) => string),
  destination = "/",
) {
  const locale = await getLocale();
  const t = getDictionary(locale).serverMessages;
  let error: string | undefined;
  let success = "";
  try {
    const result = await work();
    success = typeof message === "function" ? message(result, locale) : message;
  } catch (cause) {
    error =
      cause instanceof InputError
        ? localizeErrorMessage(cause.message, locale)
        : locale === "en"
          ? t.genericSaveError
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
  const locale = await getLocale();
  const msg = getDictionary(locale).serverMessages.routineCreated;
  await mutate(
    async () =>
      addRoutine(
        await getDatabase(),
        user,
        form.get("name"),
        form.getAll("days"),
      ),
    msg,
    destination(form),
  );
}

export async function createActivity(form: FormData) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const msg = getDictionary(locale).serverMessages.activityAdded;
  await mutate(
    async () =>
      addActivity(
        await getDatabase(),
        user,
        form.get("routineId"),
        form.get("name"),
        form.get("time"),
        activityScheduleFromForm(form),
      ),
    msg,
    destination(form),
  );
}

export async function editRoutine(form: FormData) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const msg = getDictionary(locale).serverMessages.routineUpdated;
  await mutate(
    async () =>
      updateRoutine(
        await getDatabase(),
        user,
        form.get("routineId"),
        form.get("name"),
        form.getAll("days"),
      ),
    msg,
    destination(form),
  );
}

export async function editActivity(form: FormData) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const msg = getDictionary(locale).serverMessages.activityUpdated;
  await mutate(
    async () =>
      updateActivity(
        await getDatabase(),
        user,
        form.get("activityId"),
        form.get("name"),
        form.get("time"),
        activityScheduleFromForm(form),
      ),
    msg,
    destination(form),
  );
}

export async function hideRoutine(form: FormData) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const msg = getDictionary(locale).serverMessages.routineArchived;
  await mutate(
    async () =>
      archiveRoutine(await getDatabase(), user, form.get("routineId")),
    msg,
    destination(form),
  );
}

export async function hideActivity(form: FormData) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const msg = getDictionary(locale).serverMessages.activityArchived;
  await mutate(
    async () =>
      archiveActivity(await getDatabase(), user, form.get("activityId")),
    msg,
    destination(form),
  );
}

export async function finishActivity(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () =>
      completeActivity(await getDatabase(), user, form.get("activityId")),
    (completed, locale) => completionMessage(completed, locale),
  );
}

export async function passActivity(form: FormData) {
  const user = await requireCurrentUser();
  await mutate(
    async () => skipActivity(await getDatabase(), user, form.get("activityId")),
    (skipped, locale) => skipMessage(skipped, locale),
  );
}

export async function selectPet(form: FormData) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const msg = getDictionary(locale).serverMessages.petUpdated;
  const petKind = form.get("petKind");
  await mutate(
    async () => setUserPet(await getDatabase(), user, petKind),
    msg,
    "/pets",
  );
}
