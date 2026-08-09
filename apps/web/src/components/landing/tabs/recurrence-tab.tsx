import { copy } from "../copy";
import { OccurrencesCard } from "../mocks/occurrences-card";
import { RecurrenceAppWindow } from "../mocks/recurrence-app-window";
import { TabScene } from "../tab-scene";

/** RECURRENCE scene — the recurrence editor (bleeding right) + the generated series floating over it. */
export function RecurrenceTab({ reduce }: { reduce: boolean }): JSX.Element {
  const tabCopy = copy.features.tabs.recurrence;
  return (
    <TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
      {/* próximas ocorrências flutuando à esquerda — "roda sozinho" */}
      <div className="absolute bottom-0 left-16 h-3/5 w-1/2">
        <OccurrencesCard className="h-full" />
      </div>

      {/* editor de recorrência sangrando à direita — "configura uma vez" */}
      <div className="absolute bottom-0 -right-5 w-1/2">
        <RecurrenceAppWindow reduce={reduce} />
      </div>
    </TabScene>
  );
}
