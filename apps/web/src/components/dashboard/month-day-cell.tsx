import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DayTaskRow } from "@/components/dashboard/day-task-row";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { tagsBgColors2 } from "@/consts/conts";
import { groupTasksByTime } from "@/functions/functions";
import { cn } from "@/lib/utils";
import type { TaskProps } from "@/types/types";

/** Quantas tarefas aparecem na célula antes de virar "+N". */
const MAX_VISIBLE = 3;

/**
 * Uma célula do grid do mês. Sem fill — só hairline —, seguindo a mesma regra do cartão de tarefa:
 * a janela já é o contêiner, a célula precisa de separação e não de elevação.
 *
 * Clicar abre a sheet do dia, que monta `DayTaskRow` — então concluir/editar/excluir funcionam aqui
 * exatamente como na view do dia, sem uma segunda implementação.
 */
export function MonthDayCell({
  day,
  tasks,
  isCurrentMonth,
  isSelected,
  isCurrentDay,
}: {
  day: Date;
  tasks: TaskProps[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  isCurrentDay: boolean;
}): JSX.Element {
  const { setSelectedDay } = useDailify();
  const visible = tasks.slice(0, MAX_VISIBLE);
  const extra = tasks.length - visible.length;
  const groups = groupTasksByTime(tasks);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          onClick={() => setSelectedDay(day)}
          aria-label={format(day, "d 'de' MMMM", { locale: ptBR })}
          className={cn(
            "flex h-full flex-col items-stretch gap-1 rounded-lg border p-2 text-left transition-colors",
            isSelected ? "border-foreground" : "border-surface-line",
            "hover:bg-surface-hover",
          )}
        >
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs",
              isCurrentDay && "bg-accent-primary text-primary-foreground",
              !isCurrentDay && isCurrentMonth && "text-foreground",
              !isCurrentDay && !isCurrentMonth && "text-muted-foreground",
            )}
          >
            {format(day, "d")}
          </span>

          {isCurrentMonth && visible.length > 0 && (
            <ul className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
              {visible.map((task, index) => (
                <li key={task.id} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      tagsBgColors2[index % tagsBgColors2.length],
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate text-2xs text-content-secondary">{task.title}</span>
                </li>
              ))}
              {extra > 0 && (
                <li className="font-mono text-2xs text-muted-foreground">
                  {copy.month.moreTasks.replace("{n}", String(extra))}
                </li>
              )}
            </ul>
          )}
        </button>
      </SheetTrigger>

      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>{copy.month.sheetTitle}</SheetTitle>
          <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {format(day, "EEE · d MMM", { locale: ptBR })}
          </span>
        </SheetHeader>

        <div className="scrollbar-floating min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-content-secondary">
              {copy.month.sheetEmpty}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {groups.map((group) =>
                group.tasks.map((task, index) => (
                  <li key={task.id}>
                    <DayTaskRow task={task} day={day} showTime={index === 0} />
                  </li>
                )),
              )}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
