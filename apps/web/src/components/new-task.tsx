import { Loader2, PlusIcon } from "lucide-react";
import { useId, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDailify } from "./dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { TaskForm, TaskFormValues } from "@/components/dashboard/task-form";
import { createTask } from "@/functions/api";
import { upsertTaskById } from "@/functions/functions";
import { useEntitlements } from "@/hooks/useEntitlements";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TaskInput } from "@dailify/shared";

export default function NewTask({ className }: { className: string }) {
  const { getToken } = useAuth();
  const { selectedDay, tasks, setTasks } = useDailify();
  const { canCreateTask } = useEntitlements();
  const { user } = useUser();
  const navigate = useNavigate();
  const formId = useId();

  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (values: TaskFormValues) => {
    if (!user) return;

    const token = await getToken();
    if (!token) return;

    const taskInput: TaskInput = {
      date: values.date.getTime(),
      title: values.title,
      duration: values.duration,
      tags: values.tags,
      priority: values.priority,
      repeat: values.repeat,
      links: values.links,
    };

    setLoading(true);

    const { task, error } = await createTask(token, taskInput);
    if (error || !task) {
      toast(copy.form.createError, {
        description: error,
        action: {
          label: copy.form.upgrade,
          onClick: () => navigate("/premium"),
        },
      });
    } else {
      setTasks(upsertTaskById(tasks ?? [], task));
      toast.message(copy.form.created, {
        description: format(values.date, "cccc, d 'de' MMMM 'às' HH:mm", { locale: ptBR }),
      });
    }

    setLoading(false);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size={"default"} className={className}>
          <PlusIcon />
          {copy.day.newTask}
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border-surface-line bg-surface-card">
        <DialogHeader className="text-start">
          <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">
            {copy.form.newTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-content-secondary">
            {copy.form.newDescription}
          </DialogDescription>
        </DialogHeader>

        <TaskForm
          id={formId}
          defaultDate={selectedDay}
          className="min-h-0 flex-1 scrollbar-floating"
          onSubmit={handleSubmit}
        />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="cursor-pointer">
              {copy.form.cancel}
            </Button>
          </DialogClose>

          <Button
            type="submit"
            form={formId}
            className="cursor-pointer rounded-full bg-accent-primary px-5 text-primary-foreground hover:bg-accent-hover"
            disabled={loading}
            onClick={(e) => {
              if (!canCreateTask) {
                e.preventDefault();
                toast(copy.form.limitReached, {
                  description: copy.form.limitReachedHint,
                  action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
                });
              }
            }}
          >
            {loading ? <Loader2 className="animate-spin" /> : copy.form.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
