import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { CheckIcon, EllipsisVerticalIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { completeTask, deleteTask } from "@/functions/api";
import { taskToCardData, upsertTaskById } from "@/functions/functions";
import type { TaskProps } from "@/types/types";

/**
 * Menu (⋮) da tarefa — concluir e excluir. Portado de `daily-tasks.tsx`, que ficou sem consumidor
 * quando o `home.tsx` passou a montar a `DayView`. As escritas são otimistas SÓ depois do servidor
 * responder, como manda o `components/CLAUDE.md`.
 */
function TaskActions({ task }: { task: TaskProps }): JSX.Element {
  const { tasks, setTasks } = useDailify();
  const { getToken } = useAuth();

  const onComplete = async () => {
    const token = await getToken();
    if (!token) return;
    const { error } = await completeTask(token, task.id);
    if (error) {
      toast.error(copy.task.completeError, { description: error });
      return;
    }
    setTasks(upsertTaskById(tasks ?? [], { ...task, completed: [...task.completed, Date.now()] }));
  };

  const onDelete = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      await deleteTask(token, task.id);
      setTasks((tasks ?? []).filter((t) => t.id !== task.id));
    } catch {
      toast.error(copy.task.deleteError);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label={copy.task.options}
        onClick={(e) => e.stopPropagation()}
        className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <EllipsisVerticalIcon className="size-4" />
      </PopoverTrigger>

      <PopoverContent align="end" className="flex w-40 flex-col gap-1 p-1">
        <Button
          variant="ghost"
          className="justify-start gap-2"
          onClick={(e) => {
            e.stopPropagation();
            void onComplete();
          }}
        >
          <CheckIcon className="size-4" />
          {copy.task.complete}
        </Button>

        <Button
          variant="ghost"
          className="justify-start gap-2 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            void onDelete();
          }}
        >
          <Trash2Icon className="size-4" />
          {copy.task.delete}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Uma linha da coluna do dia: o cartão + suas ações + a sheet de edição.
 *
 * O clique no cartão abre a edição por ESTADO (`open`), não por `SheetTrigger` — o TaskCard já tem
 * seu próprio botão-overlay, e envolvê-lo num trigger `asChild` aninharia botão dentro de botão.
 * `selected={open}` é o que dá ao cartão aberto a borda crimson: é o quinto papel do acento
 * ("tarefa aberta") previsto no spec, que até aqui não tinha quem o usasse.
 */
export function DayTaskRow({
  task,
  day,
  showTime,
}: {
  task: TaskProps;
  day: Date;
  showTime: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const data = taskToCardData(task, day);

  return (
    <EditTask open={open} onOpenChange={setOpen}>
      <TaskCard
        {...data}
        time={showTime ? data.time : ""}
        selected={open}
        onClick={() => setOpen(true)}
        actions={<TaskActions task={task} />}
      />
      <EditTaskContent task={task} />
    </EditTask>
  );
}
