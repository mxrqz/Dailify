import { copy } from "../copy";
import { DayAppWindow } from "../mocks/day-app-window";
import { TaskDetailSheet } from "../mocks/task-detail-sheet";
import { TabScene } from "../tab-scene";

/** DAY scene — day-view app window (bottom-right) + a task-detail sheet floating over it. */
export function DayTab(): JSX.Element {
  const tabCopy = copy.features.tabs.day;
  return (
    <TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
      <div className="absolute bottom-0 left-16 h-3/5 w-1/2">
        <TaskDetailSheet />
      </div>

      <div className="absolute bottom-0 -right-5 w-1/2">
        <DayAppWindow />
      </div>
    </TabScene>
  );
}
