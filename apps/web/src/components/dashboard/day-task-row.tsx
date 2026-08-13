import { useState } from "react";
import { CheckIcon, EllipsisVerticalIcon, Trash2Icon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { TaskDetailContent } from "@/components/dashboard/task-detail";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { taskToCardData } from "@/functions/functions";
import { useTaskActions } from "@/hooks/useTaskActions";
import type { TaskProps } from "@/types/types";

/** Menu (⋮) da tarefa — o atalho para concluir/excluir sem abrir a sheet. */
function TaskActions({ task }: { task: TaskProps }): JSX.Element {
  const { onComplete, onDelete } = useTaskActions(task);

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
 * Uma linha da coluna do dia: o cartão + suas ações + a sheet, que abre em leitura e só troca
 * para o formulário quando o usuário pede Editar (volta a leitura ao fechar).
 *
 * O clique no cartão abre a sheet por ESTADO (`open`), não por `SheetTrigger` — o TaskCard já tem
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
  const [mode, setMode] = useState<"read" | "edit">("read");
  const data = taskToCardData(task, day);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setMode("read");
  };

  return (
    <EditTask open={open} onOpenChange={onOpenChange}>
      <TaskCard
        {...data}
        time={showTime ? data.time : ""}
        selected={open}
        onClick={() => setOpen(true)}
        actions={<TaskActions task={task} />}
      />

      {mode === "read" ? (
        <TaskDetailContent
          task={task}
          day={day}
          onEdit={() => setMode("edit")}
          onClose={() => onOpenChange(false)}
        />
      ) : (
        <EditTaskContent task={task} />
      )}
    </EditTask>
  );
}
