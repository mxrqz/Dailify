import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { CalendarBadge } from "@/components/logos";
import { MewStatic } from "@/components/mew/mew-static";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { resolveDuplicate } from "@/functions/api";
import { capitalize, formatClock, upsertTaskWithRecurrence } from "@/functions/functions";
import { repeatLabel } from "@/functions/repeat-label";
import { removeUndated, upsertUndated } from "@/functions/undated";
import { zoned } from "@/functions/zone";
import { patchIntegration, useIntegrations } from "@/hooks/useIntegrations";
import type { TaskProps } from "@/types/types";

const t = copy.calendar;

export interface DuplicatePair {
  own: TaskProps;
  imported: TaskProps;
}

/** "Ter, 17 nov · 14:00 · Toda semana"; Sem data não tem hora. */
function when(task: TaskProps, hour12: boolean): string {
  const at = zoned(task.date);
  const day = format(at, "EEEEEE, d MMM", { locale: ptBR });
  return [
    task.undated ? t.noDate : capitalize(day),
    !task.undated && formatClock(format(at, "HH:mm"), hour12),
    repeatLabel(task.repeat, task.repeatEvery),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A folha das duplicatas da importação (props → markup): cada par mostra a tarefa própria e o
 * evento que veio da Agenda, com "Juntar" e "Manter as duas" embaixo.
 */
export function DuplicatesSheet({
  open,
  onOpenChange,
  pairs,
  pending,
  hour12 = false,
  onResolve,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pairs: DuplicatePair[];
  /** O `importedId` do par em voo: os botões dele ficam travados. */
  pending?: string;
  hour12?: boolean;
  onResolve: (importedId: string, action: "merge" | "keep") => void;
}): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[94svh] w-full max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {pairs.length > 1
              ? t.duplicatesTitle.replace("{n}", String(pairs.length))
              : t.duplicateTitle}
          </SheetTitle>
          <SheetDescription>{t.duplicateHint}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-col gap-7 overflow-y-auto pb-4">
          {pairs.map(({ own, imported }) => (
            <div key={imported.id} className="flex flex-col gap-3">
              <ListGroup compact>
                <ListRow
                  icon={<MewStatic title={t.mewki} className="w-5" />}
                  label={own.title}
                  sublabel={`${t.mewki} · ${when(own, hour12)}`}
                />
                <ListRow
                  icon={<CalendarBadge />}
                  label={imported.title}
                  sublabel={`${t.name} · ${when(imported, hour12)}`}
                />
              </ListGroup>
              <div className="flex gap-2 *:flex-1">
                <Button
                  variant="secondary"
                  disabled={pending === imported.id}
                  onClick={() => onResolve(imported.id, "keep")}
                >
                  {t.keep}
                </Button>
                <Button
                  disabled={pending === imported.id}
                  onClick={() => onResolve(imported.id, "merge")}
                >
                  {t.merge}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Uma vez por sessão: fechou sem resolver, só volta no próximo carregamento do app.
let shown = false;

/** O container: lê `duplicates` do status da Agenda, acha os pares nas tarefas e resolve. */
export function Duplicates(): JSX.Element | null {
  const { tasks, setTasks, undatedTasks, setUndatedTasks, loadedMonths, hour12 } = useDailify();
  const duplicates = useIntegrations()?.find((s) => s.provider === "google-calendar")?.duplicates;
  const [closed, setClosed] = useState(shown);
  const [pending, setPending] = useState<string>();

  // ponytail: par cujas tarefas não estão nos meses carregados fica de fora até aparecerem.
  const all = [...(tasks ?? []), ...(undatedTasks ?? [])];
  const pairs = (duplicates ?? []).flatMap(({ taskId, importedId }) => {
    const own = all.find((task) => task.id === taskId);
    const imported = all.find((task) => task.id === importedId);
    return own && imported ? [{ own, imported }] : [];
  });
  const open = !closed && pairs.length > 0;

  useEffect(() => {
    if (open) shown = true;
  }, [open]);

  const resolve = async (importedId: string, action: "merge" | "keep") => {
    setPending(importedId);
    const res = await resolveDuplicate(importedId, action);
    setPending(undefined);
    if (res.error) {
      toast.error(t.resolveError, { description: res.error.message });
      return;
    }
    patchIntegration("google-calendar", {
      duplicates: duplicates?.filter((d) => d.importedId !== importedId),
    });
    const { task, removedId } = res;
    if (action === "keep" || !task) return;
    // Como na edição: a própria volta com a agenda do Google e a importada sai das duas listas.
    const dated = (tasks ?? []).filter((x) => x.id !== removedId && x.id !== task.id);
    const undated = removeUndated(removeUndated(undatedTasks ?? [], removedId ?? ""), task.id);
    if (task.undated) {
      setTasks(dated);
      setUndatedTasks(upsertUndated(undated, task));
    } else {
      setTasks(upsertTaskWithRecurrence(dated, task, loadedMonths));
      setUndatedTasks(undated);
    }
    toast.success(t.merged, { description: task.title });
  };

  if (!duplicates?.length) return null;
  return (
    <DuplicatesSheet
      open={open}
      onOpenChange={(next) => !next && setClosed(true)}
      pairs={pairs}
      pending={pending}
      hour12={hour12}
      onResolve={(id, action) => void resolve(id, action)}
    />
  );
}
