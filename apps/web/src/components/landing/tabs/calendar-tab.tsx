import { copy } from "../copy";
import { CalendarAppWindow } from "../mocks/calendar-app-window";
import { DayAppWindow } from "../mocks/day-app-window";
import { TabScene } from "../tab-scene";

/** CALENDAR scene — month app window (bleeding right) + a day peek floating over it. */
export function CalendarTab(): JSX.Element {
  const tabCopy = copy.features.tabs.calendar;
  return (
    <TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
      {/* peek do dia 14 (hoje) por cima, à esquerda — reusa a janela de dia menor */}
      <div className="absolute bottom-0 left-16 h-3/5 w-1/2">
        <DayAppWindow date="Qui · 14 Ago" className="h-full" />
      </div>

      {/* mês sangrando pra direita — a janela grande */}
      <div className="absolute bottom-0 -right-5 w-1/2">
        <CalendarAppWindow />
      </div>
    </TabScene>
  );
}
