import { TaskProps } from "@/types/types";
import { ClockIcon, EllipsisVerticalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";

import { motion } from "framer-motion";
import {
  priorityTextColor,
  priorityBgColor,
  priorityBorderColor,
  priorityText,
  tagsBgColors2,
  variants,
  childVariants,
} from "@/consts/conts";
import { Timestamp } from "firebase/firestore";
import { getCompletionDate, getTime, getTasksForDay } from "@/functions/functions";
import { useDailify } from "./dailifyContext";

import { EditTask, EditTaskContent, EditTaskTrigger } from "./edit-task";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { deleteTask, markTaskAsCompleted } from "@/functions/firebase";
import { useAuth, useUser } from "@clerk/clerk-react";

export default function DailyTasks() {
  const { selectedDay, tasks, setTasks, isCalendar } = useDailify();
  const [dayTasks, setDayTasks] = useState<TaskProps[]>();
  const { user } = useUser();
  const { getToken } = useAuth();

  const updateTaskToCompleted = (taskId: string) => {
    const now = new Date();

    const updatedTasks = tasks?.map((task) => {
      if (task.id !== taskId) return task;
      const completed = task.completed ?? [];
      const isTimestamp = task.date instanceof Timestamp;

      return {
        ...task,
        completed: isTimestamp
          ? [...(completed as Timestamp[]), Timestamp.fromDate(now)]
          : [...(completed as Date[]), now],
      };
    });

    if (!updatedTasks) return;
    setTasks(updatedTasks);
  };

  const deleteTaskLocal = (taskId: string) => {
    const newTasks = tasks?.filter((task) => task.id !== taskId);
    if (!newTasks) return;
    setTasks(newTasks);
  };

  useEffect(() => {
    if (!tasks) return;
    const todayTasks = getTasksForDay(tasks, selectedDay);
    setDayTasks(todayTasks);
  }, [tasks, selectedDay, isCalendar]);

  if (!dayTasks) return;

  const groupedTasks = Object.values(
    dayTasks.reduce(
      (acc, task) => {
        const time = getTime(task.date, "HH:MM");

        if (!acc[time]) {
          acc[time] = { time: time, tasks: [] };
        }
        acc[time].tasks.push(task);
        return acc;
      },
      {} as Record<string, { time: string; tasks: typeof dayTasks }>,
    ),
  ).sort((a, b) => {
    const timeA = a.time.split(":").map(Number);
    const timeB = b.time.split(":").map(Number);
    return timeA[0] - timeB[0] || timeA[1] - timeB[1];
  });

  return (
    <section className="w-full h-full max-h-full flex flex-col gap-3 justify-between py-5">
      <motion.ul
        className="w-full h-full flex flex-col gap-5"
        variants={variants}
        initial="hidden"
        animate="visible"
      >
        <span className="text-3xl font-bold">Today's Tasks</span>

        {groupedTasks.map((group) => (
          <motion.li key={group.time} className="flex flex-col gap-2" variants={childVariants}>
            <div className="flex items-center gap-2">
              <ClockIcon className="size-5 text-muted-foreground" />
              <span className="text-base font-medium text-muted-foreground">{group.time}</span>
              <Separator className="shrink" />
            </div>

            <motion.ul
              className="flex flex-col gap-2 bg-background rounded-md border p-5 shadow"
              role="list"
              variants={variants}
              initial="hidden"
              animate="visible"
            >
              {group.tasks.map((task, index) => (
                <EditTask key={index}>
                  <EditTaskTrigger>
                    <motion.li
                      key={task.id}
                      className={`flex flex-col gap-3 w-full cursor-pointer text-start`}
                      variants={childVariants}
                    >
                      <div className="flex flex-col w-full">
                        <div className="flex w-full justify-between items-center">
                          <span className="text-lg font-semibold">{task.title}</span>

                          <div className="flex items-center gap-2">
                            <Badge variant={"outline"} className="">
                              {task.duration}
                            </Badge>

                            {task.completed && getCompletionDate(task, selectedDay) && (
                              <Badge variant={"outline"} className="border-green-500">
                                Completed
                              </Badge>
                            )}

                            <Popover>
                              <PopoverTrigger
                                onClick={(e) => e.stopPropagation()}
                                className="hover:bg-accent p-0.5 rounded-md cursor-pointer"
                              >
                                <EllipsisVerticalIcon />
                              </PopoverTrigger>

                              <PopoverContent className="flex flex-col w-32 gap-3">
                                <Button
                                  variant={"outline"}
                                  className="bg-transparent cursor-pointer"
                                  onClick={async (e) => {
                                    const token = await getToken();
                                    e.stopPropagation();
                                    if (token) markTaskAsCompleted(token, task.id);
                                    updateTaskToCompleted(task.id);
                                  }}
                                >
                                  Completed
                                </Button>

                                <Button
                                  className="bg-red-500 cursor-pointer"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (user) await deleteTask(user.id, task.id);
                                    deleteTaskLocal(task.id);
                                  }}
                                >
                                  Delete
                                </Button>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        <p className="text-base font-medium text-muted-foreground">
                          {task.description}
                        </p>
                      </div>

                      <motion.ul
                        className="w-full flex flex-wrap gap-1"
                        variants={variants}
                        initial="hidden"
                        animate="visible"
                      >
                        {task.repeat && (
                          <li className="shrink-0">
                            <Badge variant={"outline"}>
                              {typeof task.repeat === "string" ? task.repeat : "Weekly"}
                            </Badge>
                          </li>
                        )}

                        <li className="shrink-0">
                          <Badge
                            variant={"secondary"}
                            className={`${priorityTextColor[task.priority]} ${priorityBgColor[task.priority]} ${priorityBorderColor[task.priority]}`}
                          >
                            {priorityText[task.priority]}
                          </Badge>
                        </li>

                        {task.tags &&
                          task.tags.length > 0 &&
                          task.tags.map((tag, index) => (
                            <li key={index}>
                              <Badge
                                variant={"secondary"}
                                className={`${tagsBgColors2[index]} dark:text-background`}
                              >
                                {tag}
                              </Badge>
                            </li>
                          ))}
                      </motion.ul>
                    </motion.li>
                  </EditTaskTrigger>

                  <EditTaskContent task={task} />
                </EditTask>
              ))}
            </motion.ul>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
