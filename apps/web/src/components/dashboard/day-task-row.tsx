import { useState } from "react";
import { CheckIcon, EllipsisVerticalIcon, Trash2Icon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import {
  DurationMenu,
  LinksPopover,
  PriorityMenu,
  RepeatMenu,
} from "@/components/dashboard/task-meta-menus";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import { TaskCard } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { taskToCardData } from "@/functions/functions";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
 * Sem hover não há como alcançar a toolbar do cartão nem os chips, então é aí — e só aí — que o
 * cartão inteiro vira um alvo que abre a folha, e a edição no cartão é desligada INTEIRA (título
 * incluído): dois caminhos de edição no toque só dariam campo aberto sem querer. Com hover
 * (desktop) é o inverso — edita-se tudo no cartão e um clique no meio dele não faz nada. O
 * `max-width` cobre a janela estreita com mouse, onde a linha de metadados já está apertada demais
 * pra editar em cima dela.
 */
const SHEET_EDITING = "(hover: none), (max-width: 639px)";

/**
 * Uma linha da coluna do dia: o cartão + suas ações + a folha de edição, que no toque abre por
 * baixo — concluir e excluir moram no rodapé dela, sem modo leitura intermediário.
 *
 * O clique no cartão abre a folha por ESTADO (`open`), não por `SheetTrigger` — o TaskCard já tem
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
  const sheetEditing = useMediaQuery(SHEET_EDITING);
  const data = taskToCardData(task, day);
  const { onPatch, onRename } = useTaskActions(task);

  const onOpenChange = (next: boolean) => setOpen(next);

  // Um caminho de edição por vez: no toque o cartão é só leitura e tudo acontece na folha.
  const edit = sheetEditing
    ? undefined
    : {
        link: (chip: JSX.Element) => (
          <LinksPopover value={task.links ?? []} onChange={(links) => void onPatch({ links })}>
            {chip}
          </LinksPopover>
        ),
        repeat: (chip: JSX.Element) => (
          <RepeatMenu
            value={task.repeat}
            date={task.date}
            onChange={(repeat) => void onPatch({ repeat })}
          >
            {chip}
          </RepeatMenu>
        ),
        priority: (chip: JSX.Element) => (
          <PriorityMenu value={task.priority} onChange={(priority) => void onPatch({ priority })}>
            {chip}
          </PriorityMenu>
        ),
        duration: (chip: JSX.Element) => (
          <DurationMenu value={task.duration} onChange={(duration) => void onPatch({ duration })}>
            {chip}
          </DurationMenu>
        ),
      };

  return (
    <EditTask open={open} onOpenChange={onOpenChange}>
      <TaskCard
        {...data}
        time={showTime ? data.time : ""}
        selected={open}
        onClick={sheetEditing ? () => setOpen(true) : undefined}
        onTitleChange={sheetEditing ? undefined : onRename}
        edit={edit}
        actions={<TaskActions task={task} />}
      />

      <EditTaskContent task={task} day={day} open={open} onClose={() => setOpen(false)} />
    </EditTask>
  );
}
