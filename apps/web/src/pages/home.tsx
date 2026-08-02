import Header from "../components/header";
import SelectDay from "../components/select-day";
import DailyTasks from "../components/daily-tasks";
import { useDailify } from "../components/dailifyContext";
import { CalendarView } from "../components/calendar-view";

export default function Home() {
  const { selectedDay, isCalendar } = useDailify();

  return (
    <main className="h-full flex flex-col gap-5  relative" id="main">
      <Header className="px-[clamp(1rem,5vw,24rem)]" />

      <div className="px-[clamp(1rem,5vw,24rem)] flex flex-col gap-5">
        {!isCalendar ? (
          <>
            <SelectDay />
            {selectedDay && <DailyTasks />}
          </>
        ) : (
          <CalendarView />
        )}
      </div>
    </main>
  );
}
