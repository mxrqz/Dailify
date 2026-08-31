import { createContext, useContext, useEffect, useId, useState, ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { RecurrenceScopeDialog } from "@/components/dashboard/recurrence-scope-dialog";
import { TaskProps } from "@/types/types";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDailify } from "./dailifyContext";
import { Button } from "./ui/button";
import { updateTask } from "@/functions/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon, CheckIcon, Loader2, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { getCompletionDate, isTaskModified, upsertTaskWithRecurrence } from "@/functions/functions";
import {
  FORM_VIEWS,
  TaskForm,
  type FormView,
  type TaskFormValues,
} from "@/components/dashboard/task-form";
import { copy } from "@/components/dashboard/copy";
import { useTaskActions } from "@/hooks/useTaskActions";

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
  const { tasks, setTasks, selectedDay } = useDailify();
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const formId = useId();
  const [loading, setLoading] = useState<boolean>(false);
  const [view, setView] = useState<FormView>("root");
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
  const completed = getCompletionDate(task, day) === true;

  // Tarefa recorrente não tem um "salvar" óbvio: editar a série move todos os dias, editar o dia
  // clicado não é o que o PATCH fazia. Quem decide é o usuário, no diálogo abaixo.
  const handleSubmit = async (values: TaskFormValues) => {
    if (task.repeat !== "Off") {
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

    const token = await getToken();
    if (!token) {
      toast.error(copy.form.authError);
      setLoading(false);
      return;
    }

    const taskData = {
      date: values.date.getTime(),
      id: task.id,
      title: values.title,
      completed: task.completed,
      duration: values.duration,
      tags: values.tags,
      priority: values.priority,
      repeat: values.repeat,
      alert: task.alert ?? values.date.getTime(),
      links: values.links,
    };

    // Salvar sem mexer em nada ainda é "terminei aqui": a folha fecha do mesmo jeito.
    if (!isTaskModified(task, taskData)) {
      toast.info(copy.form.noChanges);
      setLoading(false);
      onClose();
      return;
    }

    const { task: updated, series, error } = await updateTask(token, task.id, taskData, occurrence);

    if (error || !updated) {
      toast(copy.form.createError, {
        description: error?.message,
        action: {
          label: copy.form.upgrade,
          onClick: () => navigate("/premium"),
        },
      });
    } else {
      toast.success(occurrence === undefined ? copy.form.updated : copy.form.scopeDetached);
      // A série vem primeiro: reexpandi-la é o que tira da lista a ocorrência que virou tarefa
      // própria (ela some pelo `exdates` novo), antes de inserir a tarefa destacada.
      const base = series
        ? upsertTaskWithRecurrence(tasks ?? [], series, selectedDay)
        : (tasks ?? []);
      setTasks(upsertTaskWithRecurrence(base, updated, selectedDay));
      onClose();
    }

    setLoading(false);
  };

  return (
    // Folha de BAIXO: no desktop a edição acontece no próprio cartão, então o painel lateral perdeu
    // a razão de existir — quem abre isto aqui é o toque, e no toque o polegar alcança o rodapé.
    // Altura FIXA, e em `svh`: a folha para sempre no mesmo lugar, tenha a página três linhas ou
    // dez, e o teclado abrindo não redimensiona nada (é o `dvh` que encolhe com ele). O conteúdo
    // rola por dentro. `pb` da safe area pro rodapé não cair sob a barra de gestos do aparelho.
    <SheetContent
      side="bottom"
      className="h-[85svh] gap-0 overflow-hidden rounded-t-panel border-surface-line bg-surface-card pb-[env(safe-area-inset-bottom)] shadow-panel"
    >
      {/* Puxador: é o que diz "isto é uma folha e sai por baixo" antes de qualquer texto. */}
      <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-surface-line" aria-hidden />

      {/* A folha é uma pilha de páginas: na raiz o cabeçalho nomeia a tarefa, dentro de um campo ele
          vira "voltar + nome do campo". O título do diálogo existe pro leitor de tela. */}
      <SheetHeader className="gap-2 pb-0">
        <SheetTitle className="sr-only">{copy.form.editTitle}</SheetTitle>
        <SheetDescription className="sr-only">{copy.form.editDescription}</SheetDescription>

        <div className="flex h-9 items-center gap-1">
          {view !== "root" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={copy.form.back}
              onClick={() => setView("root")}
              className="-ml-2 size-9 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <ChevronLeftIcon className="size-5" />
            </Button>
          )}
          <span className="text-base font-semibold">{FORM_VIEWS[view].title}</span>
        </div>
      </SheetHeader>

      <TaskForm
        id={formId}
        task={task}
        view={view}
        onView={setView}
        className="min-h-0 flex-1 scrollbar-floating px-4 pb-2"
        onSubmit={handleSubmit}
      />

      {/* "Cancelar" saiu: o ✕ e o Esc já são duas saídas, e três era ruído no caminho do Salvar.
          Rodapé sem divisória, mas com respiro: o guia de formulário mobile pede ~40px entre o
          último campo e a ação principal, e é o `pt-4` daqui somado ao `pb-2` do form. Dentro de um
          campo ele some — ali quem confirma é a própria escolha, e o Salvar é da tarefa inteira. */}
      {view === "root" && (
        <SheetFooter className="flex-row items-center gap-2 pt-4">
          {/* Concluída não desabilita mais o botão: ele vira a saída — errar o toque não pode
              custar a tarefa. */}
          <Button
            variant="ghost"
            className="h-12 flex-1 cursor-pointer gap-2 rounded-full"
            onClick={() => {
              void (completed ? onUncomplete() : onComplete());
              onClose();
            }}
          >
            {completed ? <RotateCcwIcon className="size-4" /> : <CheckIcon className="size-4" />}
            {completed ? copy.task.uncomplete : copy.task.complete}
          </Button>

          <Button
            type="submit"
            form={formId}
            className="h-12 flex-1 cursor-pointer rounded-full bg-accent-primary text-primary-foreground hover:bg-accent-hover"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : copy.form.save}
          </Button>
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

      {/* Fica no fim do DOM de propósito, ainda que apareça no topo: o Radix foca o primeiro
          elemento focável ao abrir, e um botão de excluir nessa posição significa abrir o painel
          e apertar Enter pra perder a tarefa. Aqui, quem recebe o foco é o texto da tarefa. */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={copy.task.delete}
        onClick={() => {
          void onDelete();
        }}
        className="absolute top-3 right-12 size-8 cursor-pointer text-muted-foreground hover:text-destructive"
      >
        <Trash2Icon className="size-4" />
      </Button>
    </SheetContent>
  );
}
