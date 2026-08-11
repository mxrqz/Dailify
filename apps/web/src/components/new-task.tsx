import { Loader2, PlusIcon } from "lucide-react";
import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useDailify } from "./dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { TaskForm, TaskFormHandle, TaskFormValues } from "@/components/dashboard/task-form";
import { createTask } from "@/functions/api";
import { upsertTaskById } from "@/functions/functions";
import { useEntitlements } from "@/hooks/useEntitlements";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import type { TaskInput } from "@dailify/shared";

export default function NewTask({ className }: { className: string }) {
  const { getToken } = useAuth();
  const { selectedDay, tasks, setTasks } = useDailify();
  const { canCreateTask } = useEntitlements();
  const { user } = useUser();
  const navigate = useNavigate();
  const formRef = useRef<TaskFormHandle>(null);

  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (values: TaskFormValues) => {
    if (!canCreateTask) {
      toast("Limite de tarefas atingido", {
        description: "Você atingiu o limite do seu plano neste mês.",
        action: { label: "Get Premium", onClick: () => navigate("/premium") },
      });
      return;
    }

    if (!user) return;

    const token = await getToken();
    if (!token) return;

    const taskInput: TaskInput = {
      date: values.date.getTime(),
      title: values.title,
      description: values.description,
      duration: values.duration,
      tags: values.tags,
      priority: values.priority,
      repeat: values.repeat,
    };

    setLoading(true);

    const { task, error } = await createTask(token, taskInput);
    if (error || !task) {
      toast("An error occurred", {
        description: error,
        action: {
          label: "Get Premium",
          onClick: () => navigate("/premium"),
        },
      });
    } else {
      setTasks(upsertTaskById(tasks ?? [], task));
      toast.message("Event has been created", {
        description: format(values.date, "cccc PPPpp"),
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

      <DialogContent className="max-h-[calc(100%-2rem)] overflow-hidden flex flex-col">
        <DialogHeader className="text-start">
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>Create a new task</DialogDescription>
        </DialogHeader>

        <TaskForm ref={formRef} defaultDate={selectedDay} onSubmit={handleSubmit} />

        <Button
          type="submit"
          variant={"outline"}
          className="w-full cursor-pointer"
          disabled={loading}
          onClick={() => formRef.current?.submit()}
        >
          {loading ? <Loader2 className="animate-spin" /> : <PlusIcon />}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
