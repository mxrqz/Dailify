import type { ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckIcon, ClockIcon, FlagIcon, PencilIcon, RepeatIcon, Trash2Icon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Repeat } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { TagBadge } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import {
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { priorityText, priorityTextColor } from "@/consts/conts";
import { useTaskActions } from "@/hooks/useTaskActions";
import { getCompletionDate } from "@/functions/functions";
import { cn } from "@/lib/utils";
import type { TaskProps } from "@/types/types";

function Meta({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-surface-line px-2 py-1 text-2xs text-content-secondary">
      <Icon className={cn("size-3 shrink-0", iconClassName)} aria-hidden="true" />
      {children}
    </span>
  );
}

function repeatLabel(repeat: Repeat): string {
  if (typeof repeat !== "string") return copy.form.repeatWeekly;
  const labels = {
    Off: copy.form.repeatOff,
    Daily: copy.form.repeatDaily,
    Monthly: copy.form.repeatMonthly,
    Yearly: copy.form.repeatYearly,
  };
  return labels[repeat];
}

/**
 * A sheet da tarefa em modo leitura — o que abre ao clicar no cartão. Editar troca o conteúdo
 * pelo formulário (o modo é do `DayTaskRow`, dono da `Sheet`); concluir e excluir fecham.
 */
export function TaskDetailContent({
  task,
  day,
  onEdit,
  onClose,
}: {
  task: TaskProps;
  day: Date;
  onEdit: () => void;
  onClose: () => void;
}): JSX.Element {
  const { onComplete, onDelete } = useTaskActions(task);
  const completed = getCompletionDate(task, day) === true;
  const tags = task.tags ?? [];

  return (
    <SheetContent className="w-full overflow-hidden border-surface-line bg-surface-card">
      <SheetHeader>
        <SheetTitle className="text-lg font-semibold tracking-[-0.01em]">{task.title}</SheetTitle>
        <SheetDescription className="flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
          <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
          {format(new Date(task.date), "EEE · d MMM · HH:mm", { locale: ptBR })} · {task.duration}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 scrollbar-floating">
        <div className="flex flex-wrap gap-2">
          <Meta icon={FlagIcon} iconClassName={priorityTextColor[task.priority]}>
            {priorityText[task.priority]}
          </Meta>
          <Meta icon={RepeatIcon}>{repeatLabel(task.repeat)}</Meta>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <TagBadge key={tag} label={tag} />
            ))}
          </div>
        )}
      </div>

      <SheetFooter className="flex-row justify-end gap-2">
        <Button
          variant="ghost"
          className="cursor-pointer gap-2 text-destructive hover:text-destructive"
          onClick={() => {
            void onDelete();
            onClose();
          }}
        >
          <Trash2Icon className="size-4" />
          {copy.task.delete}
        </Button>

        <Button variant="ghost" className="cursor-pointer gap-2" onClick={onEdit}>
          <PencilIcon className="size-4" />
          {copy.task.edit}
        </Button>

        <Button
          disabled={completed}
          className="cursor-pointer gap-2 rounded-full bg-accent-primary px-5 text-primary-foreground hover:bg-accent-hover"
          onClick={() => {
            void onComplete();
            onClose();
          }}
        >
          <CheckIcon className="size-4" />
          {completed ? copy.task.completed : copy.task.complete}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
