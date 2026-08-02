import { motion } from "framer-motion";
import NewTask from "./new-task";
import {
  paletteColors,
  priorityBgColor,
  priorityBorderColor,
  priorityText,
  priorityTextColor,
  tagsBgColors2,
  weekDays,
} from "@/consts/conts";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { Calendar1Icon, ChevronLeft, ChevronRight, ClockIcon, Loader2Icon } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameYear,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDailify } from "./dailifyContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { getCompletionDate, getTime, getTasksForDay } from "@/functions/functions";
import { EditTask, EditTaskContent, EditTaskTrigger } from "./edit-task";
import { Badge } from "./ui/badge";
import NewTaskVoice from "./new-task-voice";

export function CalendarView() {
  const { selectedDay, setSelectedDay, isCalendar, setIsCalendar, tasks, isLoading } = useDailify();

  const goToPreviousMonth = () => {
    // setIsLoading("Carregando Data")
    setSelectedDay(subMonths(selectedDay, 1));
  };

  const goToNextMonth = () => {
    // setIsLoading("Carregando Data")
    setSelectedDay(addMonths(selectedDay, 1));
  };

  const goToToday = () => {
    // setIsLoading("Carregando Data")
    setSelectedDay(new Date());
  };

  const generateCalendarDays = () => {
    const monthStart = startOfMonth(selectedDay);
    const monthEnd = endOfMonth(selectedDay);
    const calendarStart = startOfWeek(monthStart, { locale: ptBR });
    const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const calendarDays = generateCalendarDays();

  return (
    <motion.ul
      className="w-full h-full flex flex-col gap-3 pb-5"
      key="box"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex w-full justify-between">
        <div className="flex gap-5">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft />
          </Button>

          <Button variant="outline" className="min-w-[100px]" onClick={goToToday}>
            {format(selectedDay, "MMMM")}
            {!isSameYear(selectedDay, new Date()) &&
              ` - ${String(selectedDay.getFullYear()).slice(2, 4)}`}
          </Button>

          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight />
          </Button>
        </div>

        <div className="flex gap-5">
          <NewTask className="" />

          <NewTaskVoice />

          <Button
            // className="shrink-0"
            variant={"outline"}
            size={"icon"}
            id="calendar"
            onClick={() => setIsCalendar(!isCalendar)}
          >
            <Calendar1Icon />
          </Button>
        </div>
      </div>

      <Separator />

      <ul className="grid grid-cols-7 w-full items-center justify-items-center">
        {weekDays.map((day, index) => (
          <li key={index} className="font-semibold text-muted-foreground">
            {day.slice(0, 3).toUpperCase()}
          </li>
        ))}
      </ul>

      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2Icon className="size-12 animate-spin" />
        </div>
      ) : (
        <ul className={`grid grid-cols-7 gap-1 w-full justify-items-center h-full`}>
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, selectedDay);
            const isCurrentDay = isToday(day);

            const todayTasks = tasks && getTasksForDay(tasks, day);

            // function isAfterTime(time: Timestamp | Date): boolean {
            //   const { hours, minutes } = getTime(time, "{hours, minutes}")
            //   const now = new Date();
            //   const nowMinutes = now.getHours() * 60 + now.getMinutes();
            //   const targetMinutes = hours * 60 + minutes;

            //   return nowMinutes > targetMinutes;
            // }

            if (!todayTasks) return;

            const groupedTasks = Object.values(
              todayTasks.reduce(
                (acc, task) => {
                  const time = getTime(task.date, "HH:MM");

                  if (!acc[time]) {
                    acc[time] = { time: time, tasks: [] };
                  }
                  acc[time].tasks.push(task);
                  return acc;
                },
                {} as Record<string, { time: string; tasks: typeof todayTasks }>,
              ),
            ).sort((a, b) => {
              const timeA = a.time.split(":").map(Number);
              const timeB = b.time.split(":").map(Number);
              return timeA[0] - timeB[0] || timeA[1] - timeB[1];
            });
            return (
              <Sheet key={index}>
                <SheetTrigger className="w-full h-full">
                  <li
                    key={index}
                    className={`border w-full h-full rounded-md p-2 flex flex-col
                  ${isCurrentMonth ? "bg-background" : "bg-muted"}
                  ${isCurrentDay && " border-2 border-foreground"}
                  hover:border-primary/50 cursor-pointer`}
                  >
                    <span
                      className={`text-base font-semibold text-foreground ${!isCurrentMonth && "text-muted-foreground"} ${isCurrentDay && "text-primary font-bold"}`}
                    >
                      {format(day, "d")}
                    </span>

                    <ul className="flex md:flex-col gap-1 overflow-hidden">
                      {isCurrentMonth &&
                        todayTasks?.slice(0, 3).map((task, index) => (
                          <li
                            key={index}
                            className={`text-xs flex items-center gap-1 md:border rounded-md md:px-1`}
                          >
                            <div
                              className={`size-2 rounded-full shrink-0 ${paletteColors[index]}`}
                            />
                            <span className="truncate hidden md:flex">{task.title}</span>
                          </li>
                        ))}
                    </ul>
                  </li>
                </SheetTrigger>

                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Tasks for the Day</SheetTitle>
                    <SheetDescription>
                      View and manage your tasks for the selected day.
                    </SheetDescription>
                  </SheetHeader>

                  <ul className="w-full h-full flex flex-col gap-5 overflow-y-scroll scrollbar-floating p-4">
                    {groupedTasks.map((group) => (
                      <li key={group.time} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <ClockIcon className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            {group.time}
                          </span>
                          <Separator className="shrink" />
                        </div>

                        <ul className="flex flex-col gap-2" role="list">
                          {group.tasks.map((task, index) => (
                            <EditTask key={index}>
                              <EditTaskTrigger>
                                <li
                                  key={task.id}
                                  className={`border rounded-md p-2 shadow flex flex-col gap-2 w-full cursor-pointer text-start 
                                    ${task.completed && getCompletionDate(task, day) && "border-green-500"}`}
                                >
                                  <div className="flex flex-col w-full">
                                    <div className="flex w-full justify-between items-center">
                                      <span className="text-sm font-medium">{task.title}</span>
                                      <Badge variant={"outline"} className="text-xs">
                                        {task.duration}
                                      </Badge>
                                    </div>

                                    <p className="text-sm text-muted-foreground">
                                      {task.description}
                                    </p>
                                  </div>

                                  <ul className="w-full flex flex-wrap gap-1">
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
                                  </ul>
                                </li>
                              </EditTaskTrigger>

                              <EditTaskContent task={task} />
                            </EditTask>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </SheetContent>
              </Sheet>
            );
          })}
        </ul>
      )}
    </motion.ul>
  );
}
