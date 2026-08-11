"use client";

import { MicIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Waveform from "./wave-form";
import { useEffect, useState } from "react";
import { TaskProps } from "@/types/types";
import { TaskDetailView } from "./task-preview";
import { useDailify } from "./dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { useEntitlements } from "@/hooks/useEntitlements";
import { toast } from "sonner";
import { format } from "date-fns";

export default function NewTaskVoice() {
  const [response, setResponse] = useState<TaskProps[]>();
  const { tasks, setTasks } = useDailify();
  const { voice } = useEntitlements();

  useEffect(() => {
    if (!response) return;

    // append ALL voice tasks — a per-task setNewTask loop kept only the last one
    setTasks([...(tasks ?? []), ...response]);

    response.forEach((task) => {
      toast.message("Event has been created", {
        description: format(new Date(task.date), "cccc PPPpp"),
      });
    });
  }, [response]);

  // Voice creation is a Pro+AI capability — hide the mic entirely when not entitled.
  if (!voice) return null;

  return (
    <Dialog onOpenChange={(e) => !e && setResponse(undefined)}>
      <DialogTrigger asChild>
        <Button
          size={"icon"}
          className="size-10 shrink-0 rounded-full border border-surface-line bg-surface-card text-foreground hover:bg-surface-hover"
        >
          <MicIcon />
          <span className="sr-only">{copy.day.voiceTask}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-background">
        <DialogHeader>
          <DialogTitle>Create task by voice</DialogTitle>

          <DialogDescription>
            Record your voice to create a new task. Clearly speak the title, date, time and other
            details of the task.
          </DialogDescription>
        </DialogHeader>

        <Waveform onResponse={setResponse} />

        {response && response.map((task, index) => <TaskDetailView task={task} key={index} />)}
      </DialogContent>
    </Dialog>
  );
}
