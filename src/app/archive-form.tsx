import { hideActivity, hideRoutine } from "./actions";
import { Submit } from "./submit";

export function ArchiveForm({
  kind,
  id,
  name,
}: {
  kind: "routine" | "activity";
  id: string;
  name: string;
}) {
  const label = kind === "routine" ? "rotina" : "atividade";
  return (
    <details className="archive-confirm">
      <summary>
        Arquivar {label}: {name}
      </summary>
      <p>
        Arquivar oculta{" "}
        {label === "rotina" ? "a rotina e suas atividades" : "a atividade"} do
        dia. Histórico e pontos permanecem guardados.
      </p>
      <form
        action={kind === "routine" ? hideRoutine : hideActivity}
        aria-label={`Confirmar arquivamento de ${name}`}
      >
        <input
          type="hidden"
          name={kind === "routine" ? "routineId" : "activityId"}
          value={id}
        />
        <input type="hidden" name="returnTo" value="/rotinas" />
        <Submit>Confirmar arquivamento</Submit>
      </form>
    </details>
  );
}
