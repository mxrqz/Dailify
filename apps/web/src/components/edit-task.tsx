import { createContext, useContext, useId, useState, ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { TaskProps } from "@/types/types";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDailify } from "./dailifyContext";
import { Button } from "./ui/button";
import { updateTask } from "@/functions/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CheckIcon, Loader2, Trash2Icon } from "lucide-react";
import { getCompletionDate, isTaskModified, upsertTaskWithRecurrence } from "@/functions/functions";
import { TaskForm, TaskFormValues } from "@/components/dashboard/task-form";
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
  onClose,
}: {
  task: TaskProps;
  day: Date;
  onClose: () => void;
}) {
  const { tasks, setTasks, selectedDay } = useDailify();
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const formId = useId();
  const [loading, setLoading] = useState<boolean>(false);
  const { onComplete, onDelete } = useTaskActions(task);
  const completed = getCompletionDate(task, day) === true;

  const handleSubmit = async (values: TaskFormValues) => {
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

    if (!isTaskModified(task, taskData)) {
      toast.info(copy.form.noChanges);
      setLoading(false);
      return;
    }

    const { task: updated, error } = await updateTask(token, task.id, taskData);

    if (error || !updated) {
      toast(copy.form.createError, {
        description: error,
        action: {
          label: copy.form.upgrade,
          onClick: () => navigate("/premium"),
        },
      });
    } else {
      toast.success(copy.form.updated);
      setTasks(upsertTaskWithRecurrence(tasks ?? [], updated, selectedDay));
    }

    setLoading(false);
  };

  return (
    // Folha de BAIXO: no desktop a edição acontece no próprio cartão, então o painel lateral perdeu
    // a razão de existir — quem abre isto aqui é o toque, e no toque o polegar alcança o rodapé.
    // `max-h`, não altura fixa: o formulário rola dentro e a folha para antes de cobrir a tela.
    <SheetContent
      side="bottom"
      className="max-h-[85dvh] overflow-hidden rounded-t-panel border-surface-line bg-surface-card shadow-panel"
    >
      {/* O texto da tarefa é o cabeçalho visível; o título do diálogo existe pro leitor de tela. */}
      <SheetHeader className="pb-0">
        <SheetTitle className="sr-only">{copy.form.editTitle}</SheetTitle>
        <SheetDescription className="sr-only">{copy.form.editDescription}</SheetDescription>
      </SheetHeader>

      <TaskForm
        id={formId}
        task={task}
        className="min-h-0 flex-1 scrollbar-floating px-4"
        onSubmit={handleSubmit}
      />

      {/* "Cancelar" saiu: o ✕ e o Esc já são duas saídas, e três era ruído no caminho do Salvar. */}
      <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-surface-line">
        <Button
          variant="ghost"
          disabled={completed}
          className="cursor-pointer gap-2"
          onClick={() => {
            void onComplete();
            onClose();
          }}
        >
          <CheckIcon className="size-4" />
          {completed ? copy.task.completed : copy.task.complete}
        </Button>

        <Button
          type="submit"
          form={formId}
          className="cursor-pointer rounded-full bg-accent-primary px-5 text-primary-foreground hover:bg-accent-hover"
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : copy.form.save}
        </Button>
      </SheetFooter>

      {/* Fica no fim do DOM de propósito, ainda que apareça no topo: o Radix foca o primeiro
          elemento focável ao abrir, e um botão de excluir nessa posição significa abrir o painel
          e apertar Enter pra perder a tarefa. Aqui, quem recebe o foco é o texto da tarefa. */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={copy.task.delete}
        onClick={() => {
          void onDelete();
          onClose();
        }}
        className="absolute top-3 right-12 size-8 cursor-pointer text-muted-foreground hover:text-destructive"
      >
        <Trash2Icon className="size-4" />
      </Button>
    </SheetContent>
  );
}
