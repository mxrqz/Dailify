import { useState } from "react";

import { copy } from "@/components/dashboard/copy";
import { SwipeActions } from "@/components/dashboard/swipe-actions";
import {
  DurationMenu,
  LinksPopover,
  PriorityMenu,
  RepeatMenu,
} from "@/components/dashboard/task-meta-menus";
import { ClockCheck } from "@/components/clock-check";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import { TaskCard, TimeLabel } from "@/components/task-card";
import { taskToCardData } from "@/functions/functions";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTaskActions } from "@/hooks/useTaskActions";
import type { TaskProps } from "@/types/types";

/**
 * Sem hover não há como alcançar a toolbar do cartão nem os chips, então é aí — e só aí — que o
 * cartão inteiro vira um alvo que abre a folha, e a edição no cartão é desligada INTEIRA (título
 * incluído): dois caminhos de edição no toque só dariam campo aberto sem querer. Com hover
 * (desktop) é o inverso — edita-se tudo no cartão e um clique no meio dele não faz nada. O
 * `max-width` cobre a janela estreita com mouse, onde a linha de metadados já está apertada demais
 * pra editar em cima dela.
 */
export const SHEET_EDITING = "(hover: none), (max-width: 639px)";

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
  countdown,
}: {
  task: TaskProps;
  day: Date;
  showTime: boolean;
  /** Substitui o horário no gutter na próxima tarefa do dia ("EM 25 MIN"). */
  countdown?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const sheetEditing = useMediaQuery(SHEET_EDITING);
  const data = taskToCardData(task, day);
  const { onPatch, onRename, onComplete, onUncomplete, onDelete, deleteDialog } = useTaskActions(
    task,
    day,
  );

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
        complete: {
          done: data.completed,
          toggle: () => void (data.completed ? onUncomplete() : onComplete()),
        },
        remove: () => void onDelete(),
      };

  const time = showTime ? (countdown ?? data.time) : "";
  const card = (
    <TaskCard
      {...data}
      // No toque o horário sai do cartão e fica fora da faixa que desliza (ver abaixo).
      time={sheetEditing ? "" : time}
      upcoming={Boolean(countdown)}
      selected={open}
      check={
        <ClockCheck
          time={data.time}
          checked={data.completed}
          onCheckedChange={(next) => void (next ? onComplete() : onUncomplete())}
          label={data.completed ? copy.task.uncomplete : copy.task.complete}
        />
      }
      onClick={sheetEditing ? () => setOpen(true) : undefined}
      onTitleChange={sheetEditing ? undefined : onRename}
      edit={edit}
    />
  );

  return (
    <EditTask open={open} onOpenChange={onOpenChange}>
      {sheetEditing ? (
        <div className="flex flex-col gap-1.5">
          {time && <TimeLabel time={time} accent={Boolean(countdown)} />}
          <SwipeActions
            onComplete={() => void (data.completed ? onUncomplete() : onComplete())}
            onDelete={() => void onDelete()}
          >
            {card}
          </SwipeActions>
        </div>
      ) : (
        card
      )}

      <EditTaskContent task={task} day={day} open={open} onClose={() => setOpen(false)} />
      {deleteDialog}
    </EditTask>
  );
}
