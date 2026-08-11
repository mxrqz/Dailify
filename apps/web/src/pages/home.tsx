import { AppHeader } from "@/components/app-header";
import { useDailify } from "@/components/dailifyContext";
import { DayAside } from "@/components/dashboard/day-aside";
import { DayView } from "@/components/dashboard/day-view";
import { MonthView } from "@/components/dashboard/month-view";

/**
 * O shell do app. Declara `bg-surface-page` explicitamente: o `body` é `bg-canvas`
 * (`global.css:323`), que no dark é 6,5 pontos de L mais claro e tingido de azul — a landing escapa
 * pelo mesmo motivo, declarando a superfície no seu `<main>`.
 */
export default function Home() {
  const { isCalendar } = useDailify();

  return (
    <main className="flex min-h-dvh flex-col bg-surface-page text-foreground" id="main">
      <AppHeader className="px-gutter" />

      <div className="px-gutter pb-10 pt-6">
        {isCalendar ? (
          <MonthView />
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_20rem]">
            <DayView />
            <DayAside />
          </div>
        )}
      </div>
    </main>
  );
}
