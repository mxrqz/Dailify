import { createContext, useContext, useEffect, useId, useMemo, useState, ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { AddToCalendar } from "@/components/add-to-calendar";
import { RecurrenceScopeDialog } from "@/components/dashboard/recurrence-scope-dialog";
import { TaskProps } from "@/types/types";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDailify } from "./dailifyContext";
import { Button } from "./ui/button";
import { updateTask } from "@/functions/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon, CheckIcon, Loader2, RotateCcwIcon } from "lucide-react";
import { getCompletionDate, isTaskModified, upsertTaskWithRecurrence } from "@/functions/functions";
import {
  FORM_VIEWS,
  TaskForm,
  type FormView,
  type TaskFormValues,
} from "@/components/dashboard/task-form";
import { copy } from "@/components/dashboard/copy";
import { useTaskActions } from "@/hooks/useTaskActions";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useUndatedActions } from "@/hooks/useUndatedActions";
import { editTaskInput } from "@/functions/edit-input";
import { enqueue } from "@/functions/offline";
import { removeUndated, upsertUndated } from "@/functions/undated";
import { zoned } from "@/functions/zone";

type EditTaskProps = Record<string, never>;

const EditTaskContext = createContext<EditTaskProps | undefined>(undefined);

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
    <EditTaskContext.Provider value={{}}>
      <Sheet open={open} onOpenChange={onOpenChange}>
        {children}
      </Sheet>
    </EditTaskContext.Provider>
  );
}

export function useEditTask() {
  const context = useContext(EditTaskContext);
  if (!context) {
    throw new Error("useEditTask must be used within a EditTask");
  }
  return context;
}

export function EditTaskTrigger({ children }: { children: ReactNode }) {
  return <SheetTrigger asChild>{children}</SheetTrigger>;
}

/** Sem data marca por período e exclui sem diálogo de escopo; só quem é Sem data paga o hook. */
function WithUndatedActions({
  task,
  children,
}: {
  task: TaskProps;
  children: (actions: ReturnType<typeof useUndatedActions>) => JSX.Element;
}): JSX.Element {
  return children(useUndatedActions(task));
}

export function EditTaskContent({
  task,
  day,
  open,
  onClose,
}: {
  task: TaskProps;
  day: Date;
  /** Só pra saber quando a folha fechou: reabrir tem que cair na raiz, não na última página. */
  open?: boolean;
  onClose: () => void;
}) {
  const { tasks, setTasks, undatedTasks, setUndatedTasks, loadedMonths, hour12 } = useDailify();
  const knownTags = useMemo(
    () => [...new Set((tasks ?? []).flatMap((t) => t.tags ?? []))],
    [tasks],
  );
  const { getToken, userId } = useAuth();
  const { user } = useUser();
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
  const locked =
    useIntegrations()
      ?.find((s) => s.provider === "google-calendar")
      ?.readonly?.includes(task.id) ?? false;

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

    const input = editTaskInput(values, zoned());
    // Sem data sem lembrete mantém a `date` (é a ordem da lista); salvar não a joga pro fim.
    const date =
      values.undated && !input.alert && wasUndated ? task.date : (input.date ?? task.date);
    // Agenda: o alerta acompanha a tarefa; o lembrete das 09:00 de Sem data não vale lá.
    const alert = values.undated ? input.alert : wasUndated ? date : (task.alert ?? date);
    const at = Date.now();
    const taskData = {
      ...task,
      ...input,
      repeatEvery: input.repeatEvery ?? undefined,
      date,
      alert,
      updatedAt: at,
    };

    // Salvar sem mexer em nada ainda é "terminei aqui": a folha fecha do mesmo jeito.
    // `isTaskModified` compara `alert ?? date`: em Sem data limpar o lembrete (date === alert)
    // passaria por "sem alterações".
    const unchanged =
      !isTaskModified(task, taskData) &&
      wasUndated === values.undated &&
      (!values.undated || task.alert === alert);
    if (unchanged) {
      toast.info(copy.form.noChanges);
      setLoading(false);
      onClose();
      return;
    }

    // Sem rede o Clerk também não renova o token — e isso não pode custar a edição.
    const token = await getToken().catch(() => null);
    if (!token && navigator.onLine) {
      toast.error(copy.form.authError);
      setLoading(false);
      return;
    }

    // `alert: null` limpa o lembrete no servidor; ausente ele manteria o antigo. `updatedAt` é a
    // hora da edição (LWW), não a do envio — vale também quando ela sobe pela fila.
    const patch = { ...input, date, alert: alert ?? null, updatedAt: at };
    const result: Awaited<ReturnType<typeof updateTask>> = token
      ? await updateTask(token, task.id, patch, occurrence)
      : { error: { message: copy.task.queued, offline: true } };
    const { series, error } = result;
    let updated = result.task;

    if (error?.offline && userId) {
      enqueue(userId, { op: "patch", taskId: task.id, patch, at, occurrence });
      toast(copy.task.queued);
      if (occurrence !== undefined) {
        // O destaque da ocorrência é do servidor; até lá só a instância da tela muda.
        setTasks(
          (tasks ?? []).map((t) => (t.id === task.id && t.date === occurrence ? taskData : t)),
        );
        onClose();
        setLoading(false);
        return;
      }
      updated = taskData;
    } else if (error || !updated) {
      toast(copy.form.createError, {
        description: error?.message,
        action: {
          label: copy.form.upgrade,
          onClick: () => navigate("/premium"),
        },
      });
      setLoading(false);
      return;
    } else {
      toast.success(occurrence === undefined ? copy.form.updated : copy.form.scopeDetached);
    }

    // A série vem primeiro: reexpandi-la é o que tira da lista a ocorrência que virou tarefa
    // própria (ela some pelo `exdates` novo), antes de inserir a tarefa destacada.
    const base = series
      ? upsertTaskWithRecurrence(tasks ?? [], series, loadedMonths)
      : (tasks ?? []);
    // Mudar de lado tira de uma lista e põe na outra; série só expande na agenda.
    if (updated.undated) {
      setTasks(occurrence === undefined ? base.filter((t) => t.id !== updated.id) : base);
      setUndatedTasks(upsertUndated(undatedTasks ?? [], updated));
    } else {
      setTasks(upsertTaskWithRecurrence(base, updated, loadedMonths));
      if (wasUndated) setUndatedTasks(removeUndated(undatedTasks ?? [], updated.id));
    }
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
            <Button type="submit" form={formId} size="lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : copy.form.save}
            </Button>
          )}
          {/* Concluída não desabilita o botão: ele vira o reabrir. */}
          {wasUndated ? (
            <WithUndatedActions task={task}>
              {({ done, toggle }) => completeButton(done, toggle)}
            </WithUndatedActions>
          ) : (
            completeButton(completedOnDay, completedOnDay ? onUncomplete : onComplete)
          )}
          {wasUndated ? (
            <WithUndatedActions task={task}>
              {({ remove }) =>
                deleteButton(() => {
                  void remove();
                  onClose();
                })
              }
            </WithUndatedActions>
          ) : (
            deleteButton(() => void onDelete())
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
