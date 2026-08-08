import { TaskCard, type TaskCardData } from "../task-card";

const DAY_EARLY: ReadonlyArray<TaskCardData> = [
  { time: "08:30", title: "Revisar PRs", duration: "45min", tags: ["dev", "review"] },
];
const DAY_LATE: ReadonlyArray<TaskCardData> = [
  { time: "11:00", title: "Escrever proposta", duration: "1h", tags: ["deep work"] },
  { time: "13:30", title: "Almoço com o time", duration: "1h", tags: ["pessoal"] },
];

/** Decorative day-timeline mock — real TaskCards split by the "agora" divider. Not wired to data. */
export function DayColumn(): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {DAY_EARLY.map((t) => (
        <TaskCard key={t.time} {...t} />
      ))}
      <div className="flex items-center gap-3 py-0.5">
        <span className="w-12 shrink-0 text-right font-mono text-2xs text-accent-primary">
          agora
        </span>
        <span className="h-px flex-1 bg-accent-primary shadow-[0_0_10px_var(--accent-glow)]" />
      </div>
      {DAY_LATE.map((t) => (
        <TaskCard key={t.time} {...t} />
      ))}
    </div>
  );
}
