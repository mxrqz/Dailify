import { Calendar1Icon } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useDailify } from "./dailifyContext";
import NewTask from "./new-task";
import { TaskProps } from "@/types/types";
import Calendar2 from "./ui/calendar2";
import { getNextTask } from "@/functions/functions";
import NewTaskVoice from "./new-task-voice";

export default function SelectDay() {
  const { setIsCalendar, isCalendar, currentMonthTasks } = useDailify();
  const [nextTask, setNextTask] = useState<TaskProps>();

  useEffect(() => {
    if (currentMonthTasks) {
      const task = getNextTask(currentMonthTasks);
      setNextTask(task);
    }
  }, [currentMonthTasks]);

  return (
    <section className="flex flex-col md:flex-row md:h-88 gap-5 w-full">
      <Calendar2 />

      <div className="flex flex-col md:grid md:grid-rows-2 w-full gap-3">
        <div className="flex w-full gap-3 h-full">
          <div className="flex gap-3 w-full">
            <NewTask className="w-full shrink aspect-square md:h-full border cursor-pointer" />

            <NewTaskVoice />
          </div>

          <Button
            size={"icon"}
            id="calendar"
            onClick={() => setIsCalendar(!isCalendar)}
            className="w-full shrink md:h-full bg-background border text-foreground hover:bg-background/5 cursor-pointer"
          >
            <Calendar1Icon />
          </Button>
        </div>

        <div className="bg-background w-full flex flex-col justify-between items-center gap-3 p-3 border rounded-md h-full">
          <span className="text-2xl font-bold">Upcoming Task</span>

          {nextTask && (
            <div className="w-full border border-primary rounded-md p-2 flex flex-col">
              <span className="text-lg font-bold">{nextTask?.title}</span>
              <span className="text-muted-foreground">
                {format(new Date(nextTask.date), "PPPP, p")}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
