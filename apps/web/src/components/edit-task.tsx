import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { AddToCalendar } from "@/components/add-to-calendar";
import { RecurrenceScopeDialog } from "@/components/dashboard/recurrence-scope-dialog";
import type { Task } from "@dailify/shared";
import { useSession } from "@/lib/auth";
import { useDailify } from "./dailifyContext";
import { Button } from "./ui/button";
import { replaceCalendarMeet, updateTask } from "@/functions/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import { getCompletionDate } from "@/functions/functions";
import {
  FORM_VIEWS,
  TaskForm,
  type FormView,
  type TaskFormValues,
} from "@/components/dashboard/task-form";
import { copy } from "@/components/dashboard/copy";
import { useTaskActions } from "@/hooks/useTaskActions";
import { useCalendarReady, useIntegration } from "@/hooks/useIntegrations";
import { calendarRevoked, useApplyTask } from "@/hooks/useCalendarPush";
import { INTEGRATION_ERROR, isCalendarEventLink, seriesOf } from "@dailify/shared";
import { useUndatedActions } from "@/hooks/useUndatedActions";
import { buildEdit } from "@/functions/edit-input";
import { enqueue, shouldQueue } from "@/functions/offline";
import { swapTasks, swapUndated } from "@/functions/task-lists";
import { zoned } from "@/functions/zone";

export function EditTask({
  children,
  open,
  onOpenChange,
}: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children}
    </Sheet>
  );
}

/** Sem data marca por período e exclui sem diálogo de escopo; só quem é Sem data paga o hook. */
function UndatedFooterButtons({
  task,
  onClose,
  completeButton,
  deleteButton,
}: {
  task: Task;
  onClose: () => void;
  completeButton: (done: boolean, toggle: () => Promise<unknown>) => JSX.Element;
  deleteButton: (onClick: () => void) => JSX.Element;
}): JSX.Element {
  const { done, toggle, remove } = useUndatedActions(task);
  return (
    <>
      {completeButton(done, toggle)}
      {deleteButton(() => {
        void remove();
        onClose();
      })}
    </>
  );
}

interface EditTaskContentProps {
  task: Task;
  day: Date;
  /** Monta a folha no primeiro open; ao fechar, reabrir tem que cair na raiz, não na última página. */
  open: boolean;
  onClose: () => void;
}

/**
 * Cada linha da agenda tem a sua folha: fechada, ela não monta (os hooks dela — tags, integrações,
 * ações — custavam por linha a cada render). Depois do primeiro open fica montada, pela animação de
 * saída.
 */
export function EditTaskContent(props: EditTaskContentProps) {
  const [opened, setOpened] = useState(props.open);
  if (props.open && !opened) setOpened(true);
  return opened ? <EditTaskSheet {...props} /> : null;
}

function EditTaskSheet({ task, day, open, onClose }: EditTaskContentProps) {
  const { tasks, setTasks, setUndatedTasks, loadedMonths, hour12 } = useDailify();
  const knownTags = useMemo(
    () => [...new Set((tasks ?? []).flatMap((t) => t.tags ?? []))],
    [tasks],
  );
  const user = useSession().data?.user;
  const userId = user?.id;
  const navigate = useNavigate();
  const formId = useId();
  const [loading, setLoading] = useState<boolean>(false);
  const [view, setView] = useState<FormView>("root");
  const [dirty, setDirty] = useState(false);
  /** Valores segurando na mão enquanto o usuário escolhe entre a ocorrência e a série. */
  const [pendingValues, setPendingValues] = useState<TaskFormValues | null>(null);

  useEffect(() => {
    if (!open) setView("root");
  }, [open]);
  // onDeleted fecha a folha só depois que a exclusão aconteceu — fechar no clique desmontaria
  // o diálogo de escopo antes de o usuário escolher.
  const { onComplete, onUncomplete, onDelete, deleteDialog } = useTaskActions(task, day, {
    onDeleted: onClose,
  });
  const wasUndated = task.undated === true;
  const locked = useIntegration("google-calendar")?.readonly?.includes(task.id) ?? false;
  const calendarReady = useCalendarReady();
  const applyTask = useApplyTask();

  const newMeet = async () => {
    const res = await replaceCalendarMeet(task.id);
    if (res.task) {
      applyTask(res.task);
      toast.success(copy.form.meetReplaced);
      return res.task.links ?? [];
    }
    if (res.error?.code === INTEGRATION_ERROR.reconnect) calendarRevoked(navigate);
    else toast.error(copy.form.meetError, { description: res.error?.message });
  };

  // Tarefa recorrente não tem um "salvar" óbvio: editar a série move todos os dias, editar o dia
  // clicado não é o que o PATCH fazia. Quem decide é o usuário, no diálogo abaixo.
  const handleSubmit = async (values: TaskFormValues) => {
    // Série em Sem data não tem ocorrência para destacar: a edição é sempre da série.
    if (task.repeat !== "Off" && !wasUndated) {
      setPendingValues(values);
      return;
    }
    await save(values);
  };

  const applyScope = (occurrence: number | undefined) => {
    const values = pendingValues;
    setPendingValues(null);
    if (values) void save(values, occurrence);
  };

  const save = async (values: TaskFormValues, occurrence?: number) => {
    if (!user) {
      toast.warning(copy.form.authError);
      return;
    }

    setLoading(true);

    const { input, taskData, unchanged } = buildEdit(task, values, zoned());
    const { date, alert, updatedAt: at } = taskData;

    // Salvar sem mexer em nada ainda é "terminei aqui": a folha fecha do mesmo jeito.
    if (unchanged) {
      toast.info(copy.form.noChanges);
      setLoading(false);
      onClose();
      return;
    }

    // `alert: null` limpa o lembrete no servidor; ausente ele manteria o antigo. `updatedAt` é a
    // hora da edição (LWW), não a do envio — vale também quando ela sobe pela fila.
    // The form shows the tapped occurrence: a whole-series edit shifts the anchor by the same
    // amount, or it would re-anchor the series there and drop every earlier occurrence.
    const shift = occurrence === undefined && !values.undated ? seriesOf(task).date - task.date : 0;
    // An instance's own `alert` is already the anchor's; only one that fell back to `date` moves.
    const seriesAlert = task.alert === undefined && alert !== undefined ? alert + shift : alert;
    const patch = { ...input, date: date + shift, alert: seriesAlert ?? null, updatedAt: at };
    const result = await updateTask(task.id, patch, occurrence);
    const { series, error } = result;
    let updated = result.task;

    if (shouldQueue(error) && userId) {
      enqueue(userId, { op: "patch", taskId: task.id, patch, at, occurrence });
      toast(copy.task.queued);
      if (occurrence !== undefined) {
        // O destaque da ocorrência é do servidor; até lá só a instância da tela muda.
        setTasks((cur = []) =>
          cur.map((t) => (t.id === task.id && t.date === occurrence ? taskData : t)),
        );
        onClose();
        setLoading(false);
        return;
      }
      updated = { ...seriesOf(taskData), date: patch.date, alert: seriesAlert };
    } else if (error || !updated) {
      // Only a quota refusal is fixed by a plan; any other failure gets no Upgrade button.
      toast(copy.form.createError, {
        description: error?.message,
        action:
          error?.status === 429
            ? { label: copy.form.upgrade, onClick: () => navigate("/premium") }
            : undefined,
      });
      setLoading(false);
      return;
    } else {
      toast.success(occurrence === undefined ? copy.form.updated : copy.form.scopeDetached);
    }

    // A série vem primeiro: reexpandi-la é o que tira da lista a ocorrência que virou tarefa
    // própria (ela some pelo `exdates` novo), antes de inserir a tarefa destacada. Mudar de lado
    // tira de uma lista e põe na outra.
    const into = series ? [series, updated] : [updated];
    const gone = series || occurrence === undefined ? [task.id] : [];
    setTasks((cur) => swapTasks(cur ?? [], gone, into, loadedMonths));
    setUndatedTasks((cur) => swapUndated(cur ?? [], gone, into));
    onClose();
    setLoading(false);
  };

  const completedOnDay = getCompletionDate(task, day) === true;
  // Com algo a salvar, o "Salvar" vira o primário; concluída, o botão é o reabrir.
  const completeButton = (done: boolean, toggle: () => Promise<unknown>) => (
    <Button
      size="lg"
      variant={done || dirty ? "secondary" : "default"}
      onClick={() => {
        void toggle();
        onClose();
      }}
    >
      {done ? <RotateCcwIcon /> : <CheckIcon />}
      {done ? copy.task.uncomplete : copy.task.complete}
    </Button>
  );
  const deleteButton = (onClick: () => void) => (
    <Button variant="ghost" onClick={onClick} className="text-body text-brand-text">
      {copy.task.delete}
    </Button>
  );

  return (
    // Folha de BAIXO: no desktop a edição acontece no próprio cartão; quem abre isto é o toque.
    // Altura pelo conteúdo, com teto em `svh` (o `dvh` encolheria com o teclado).
    <SheetContent side="bottom" className="mx-auto max-h-[94svh] w-full max-w-lg">
      <SheetTitle className="sr-only">{copy.form.editTitle}</SheetTitle>
      <SheetDescription className="sr-only">{copy.form.editDescription}</SheetDescription>

      {/* Na raiz o título da tarefa é o cabeçalho (do formulário); dentro de um campo vira
          "voltar + nome dele". */}
      {view !== "root" && (
        <SheetHeader className="pb-2">
          <div className="flex h-9 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={copy.form.back}
              onClick={() => setView("root")}
              className="relative -ml-2 size-9 hit-target text-ink-secondary hover:text-ink"
            >
              <ChevronLeftIcon className="size-5" />
            </Button>
            <span className="text-body font-semibold">{FORM_VIEWS[view].title}</span>
          </div>
        </SheetHeader>
      )}

      <TaskForm
        id={formId}
        task={task}
        view={view}
        onView={setView}
        onDirtyChange={setDirty}
        knownTags={knownTags}
        hour12={hour12}
        locked={locked}
        onNewMeet={
          calendarReady && !locked && task.links?.some(isCalendarEventLink) ? newMeet : undefined
        }
        className="min-h-0 flex-1 scrollbar-floating"
        onSubmit={handleSubmit}
      >
        <AddToCalendar task={task} variant="sheet" />
      </TaskForm>

      {/* Editar é tocar na linha; "Salvar" só aparece quando algo mudou. Dentro de um campo o rodapé
          some: ali quem confirma é a própria escolha. */}
      {view === "root" && (
        <SheetFooter className="gap-1 pb-4">
          {dirty && (
            <Button type="submit" form={formId} size="lg" loading={loading}>
              {copy.form.save}
            </Button>
          )}
          {/* Concluída não desabilita o botão: ele vira o reabrir. */}
          {wasUndated ? (
            <UndatedFooterButtons
              task={task}
              onClose={onClose}
              completeButton={completeButton}
              deleteButton={deleteButton}
            />
          ) : (
            <>
              {completeButton(completedOnDay, completedOnDay ? onUncomplete : onComplete)}
              {deleteButton(() => void onDelete())}
            </>
          )}
        </SheetFooter>
      )}

      {/* A escolha só aparece pra tarefa recorrente, e só na hora de salvar: perguntar antes seria
          ruído em toda edição. O diálogo gêmeo, o de excluir, vem do hook. */}
      <RecurrenceScopeDialog
        open={pendingValues !== null}
        onOpenChange={(open) => !open && setPendingValues(null)}
        description={copy.form.scopeDescription}
        onOccurrence={() => applyScope(task.date)}
        onSeries={() => applyScope(undefined)}
      />
      {deleteDialog}
    </SheetContent>
  );
}
