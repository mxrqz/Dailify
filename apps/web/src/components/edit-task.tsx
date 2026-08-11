import { createContext, useContext, useState, ReactNode, useRef } from "react";
import {
  Sheet,
  SheetClose,
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
import { Loader2 } from "lucide-react";
import { isTaskModified, upsertTaskById } from "@/functions/functions";
import { TaskForm, TaskFormHandle, TaskFormValues } from "@/components/dashboard/task-form";

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

export function EditTaskContent({ task }: { task: TaskProps }) {
  const { tasks, setTasks } = useDailify();
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const formRef = useRef<TaskFormHandle>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (values: TaskFormValues) => {
    if (!user) {
      toast.warning("User not authenticated or invalid references.");
      return;
    }

    setLoading(true);

    const token = await getToken();
    if (!token) {
      toast.error("Authentication token is missing.");
      setLoading(false);
      return;
    }

    const taskData = {
      date: values.date.getTime(),
      id: task.id,
      title: values.title,
      description: values.description,
      completed: task.completed,
      duration: values.duration,
      tags: values.tags,
      priority: values.priority,
      repeat: values.repeat,
      alert: task.alert ?? values.date.getTime(),
    };

    if (!isTaskModified(task, taskData)) {
      toast.info("No changes made to the task.");
      setLoading(false);
      return;
    }

    const { task: updated, error } = await updateTask(token, task.id, taskData);

    if (error || !updated) {
      toast("An error occurred", {
        description: error,
        action: {
          label: "Get Premium",
          onClick: () => navigate("/premium"),
        },
      });
    } else {
      toast.success("Task updated successfully!");
      setTasks(upsertTaskById(tasks ?? [], updated));
    }

    setLoading(false);
  };

  return (
    <SheetContent className="w-full overflow-hidden">
      <SheetHeader>
        <SheetTitle>Edit Task</SheetTitle>
        <SheetDescription>Update your task details</SheetDescription>
      </SheetHeader>

      <TaskForm ref={formRef} task={task} onSubmit={handleSubmit} />

      <SheetFooter className="flex-row justify-end">
        <SheetClose>
          <Button variant={"outline"} className="cursor-pointer">
            Cancel
          </Button>
        </SheetClose>

        <Button
          className="cursor-pointer bg-primary"
          disabled={loading}
          onClick={() => formRef.current?.submit()}
        >
          {loading ? <Loader2 className="animate-spin" /> : <>Save</>}
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
