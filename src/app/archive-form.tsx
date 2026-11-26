import { getDictionary, type Locale } from "../lib/i18n";
import { hideActivity, hideRoutine } from "./actions";
import { Submit } from "./submit";

export function ArchiveForm({
  kind,
  id,
  name,
  locale = "pt",
}: {
  kind: "routine" | "activity";
  id: string;
  name: string;
  locale?: Locale;
}) {
  const t = getDictionary(locale).manage.archive;
  const noun = kind === "routine" ? t.routineNoun : t.activityNoun;
  return (
    <details className="archive-confirm">
      <summary>{t.summary(noun, name)}</summary>
      <p>{t.warning(kind === "routine")}</p>
      <form
        action={kind === "routine" ? hideRoutine : hideActivity}
        aria-label={t.ariaLabel(name)}
      >
        <input
          type="hidden"
          name={kind === "routine" ? "routineId" : "activityId"}
          value={id}
        />
        <input type="hidden" name="returnTo" value="/rotinas" />
        <Submit locale={locale}>{t.confirmBtn}</Submit>
      </form>
    </details>
  );
}
