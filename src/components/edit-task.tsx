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
import RepeatPicker from "./ui/repeat-picker";
import { Label } from "./ui/label";
import TagsPicker from "./ui/tags-picker";
import PriorityPicker from "./ui/priority-picker";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Timestamp } from "firebase/firestore";
import { useDailify } from "./dailifyContext";
import { Button } from "./ui/button";
import { saveEditedTask } from "@/functions/firebase";
import { DatetimePicker } from "./ui/datetime-picker";
import { DateInput, TimeField } from "./ui/timefield";
import { TimeValue } from "react-aria-components";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { isTaskModified, upsertTaskById } from "@/functions/functions";

type EditTaskProps = Record<string, never>;

const EditTaskContext = createContext<EditTaskProps | undefined>(undefined);

export function EditTask({ children }: { children: ReactNode }) {
  return (
    <EditTaskContext.Provider value={{}}>
      <Sheet>{children}</Sheet>
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
  const navigate = useNavigate();

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(
    task.date instanceof Timestamp ? (task.date as Timestamp).toDate() : (task.date as Date),
  );
  const [selectedDuration, setSelectedDuration] = useState<string>(task.duration);
  const [priority, setPriority] = useState<number>(0);
  const [tags, setTags] = useState<string[]>();
  const [repeat, setRepeat] = useState<
    "Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] | undefined }
  >();
  const { user } = useUser();
  const [loading, setLoading] = useState<boolean>(false);

  const handleDurationChange = (e: TimeValue) => {
    const { hour, minute } = e;
    const finalMessage = `${hour && hour !== 0 ? hour + "h" : ""}${minute && minute !== 0 ? minute + "m" : ""}`;
    setSelectedDuration(finalMessage);
  };

  // const editTask = async () => {
  //     if (!user || !titleRef.current || !descriptionRef.current || !selectedDate || !selectedDuration || priority === null || !repeat) return

  //     const title = titleRef.current.value
  //     const desc = descriptionRef.current.value
  //     const id = task.id

  //     if (!title) {
  //         toast.warning('Title is required');
  //         return;
  //     } else if (!desc) {
  //         toast.warning('Description is required');
  //         return;
  //     } else if (!selectedDate || !selectedDuration || priority === null || !repeat) {
  //         toast.warning('All fields are required')
  //         return;
  //     }

  //     setLoading(true)

  //     const token = await getToken()
  //     if (!token) return

  //     const taskData = {
  //         date: selectedDate,
  //         id,
  //         description: desc,
  //         title,
  //         completed: [],
  //         duration: selectedDuration,
  //         tags: tags,
  //         priority,
  //         repeat
  //     }

  //     const { error } = await saveEditedTask(taskData, token)
  //     if (error) {
  //         toast('An error occurred', {
  //             description: error,
  //             action: {
  //                 label: 'Get Premium',
  //                 onClick: () => navigate('/prices')
  //             },
  //         })
  //     } else {
  //         setNewTask(taskData)
  //     }

  //     setLoading(false)
  // }

  const editTask = async () => {
    if (!user || !titleRef.current || !descriptionRef.current) {
      toast.warning("User not authenticated or invalid references.");
      return;
    }

    const title = titleRef.current.value.trim();
    const desc = descriptionRef.current.value.trim();

    if (!title) return toast.warning("Title is required.");
    if (!desc) return toast.warning("Description is required.");
    if (!selectedDate) return toast.warning("Date is required.");
    if (!selectedDuration) return toast.warning("Duration is required.");
    if (priority === null) return toast.warning("Priority is required.");
    if (!repeat) return toast.warning("Repeat option is required.");

    setLoading(true);

    const token = await getToken();
    if (!token) {
      toast.error("Authentication token is missing.");
      setLoading(false);
      return;
    }

    const taskData = {
      date: selectedDate,
      id: task.id,
      title,
      description: desc,
      completed: task.completed,
      duration: selectedDuration,
      tags,
      priority,
      repeat,
      alert: task.alert ? task.alert : selectedDate,
    };

    if (!isTaskModified(task, taskData)) {
      toast.info("No changes made to the task.");
      setLoading(false);
      return;
    }

    const { error } = await saveEditedTask(taskData, token);

    if (error) {
      toast("An error occurred", {
        description: error,
        action: {
          label: "Get Premium",
          onClick: () => navigate("/premium"),
        },
      });
    } else {
      toast.success("Task updated successfully!");
      setTasks(upsertTaskById(tasks ?? [], taskData));
    }

    setLoading(false);
  };

  const handleDurationValue = () => {
    if (!task.duration) return;

    const hourMatch = task.duration.match(/(\d+)h/);
    const minuteMatch = task.duration.match(/(\d+)m/);

    const value = {
      hour: hourMatch ? parseInt(hourMatch[1]) : 0,
      millisecond: 0,
      minute: minuteMatch ? parseInt(minuteMatch[1]) : 0,
      second: 0,
    };

    return value as TimeValue;
  };

  return (
    <SheetContent className="w-full overflow-hidden">
      <SheetHeader>
        <SheetTitle>Edit Task</SheetTitle>
        <SheetDescription>Update your task details</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 scrollbar-floating px-5">
        <div className="flex flex-col gap-1">
          <Label htmlFor="title">Title</Label>
          <Input
            ref={titleRef}
            id="title"
            defaultValue={task.title}
            type="text"
            placeholder="Task title"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="description">Description</Label>
          <Textarea
            ref={descriptionRef}
            id="description"
            defaultValue={task.description}
            className="resize-none"
            rows={3}
            maxLength={250}
            placeholder="Task description"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="date">Date</Label>

            <DatetimePicker
              value={selectedDate}
              className="border-1"
              onChange={(e) => e && setSelectedDate(e)}
              format={[
                ["months", "days", "years"],
                ["hours", "minutes", "am/pm"],
              ]}
            />
          </div>

          <div className="w-full">
            <TimeField
              aria-label="Duration"
              id="duration"
              value={handleDurationValue() && handleDurationValue()}
              onChange={(e) => e && handleDurationChange(e)}
              className="flex flex-col gap-1 w-full rounded-md"
            >
              <Label htmlFor="duration">Duration</Label>

              <div className="flex border rounded-md items-center px-2 focus-within:border-primary">
                <DateInput
                  className={
                    "border-0 h-9 data-[focus-within]:ring-0 data-[focus-within]:ring-offset-0 p-0"
                  }
                />
                {/* <span>{selectedDuration as string}</span> */}
              </div>
            </TimeField>
          </div>
        </div>

        {/* <div className="w-full flex items-center gap-3">
                    <div className="flex flex-col gap-1 w-full">
                        <Label htmlFor="date">Date</Label>
                        <DatePicker id="date" onSelectedDate={setSelectedDate} currentSelectedDate={selectedDate} />
                    </div>

                    <div className="flex flex-col gap-1 w-full">
                        <Label htmlFor="time">Time</Label>
                        <TimePicker
                            onSelectedTime={setSelectedDate}
                            selectedDate={selectedDate}
                            task={task}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <Label htmlFor="duration">Duration</Label>
                    <DurationPicker onSelectedDuration={setSelectedDuration} task={task} />
                </div> */}

        <div className="flex flex-col gap-1">
          <Label htmlFor="priority">Priority</Label>
          <PriorityPicker onSelectedPriority={setPriority} task={task} />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="tags">Tags</Label>
          <TagsPicker onSelectedTags={setTags} task={task} />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="repeat">Repeat</Label>
          <RepeatPicker onSelectedRepeat={setRepeat} task={task} />
        </div>
      </div>

      <SheetFooter className="flex-row justify-end">
        <SheetClose>
          <Button variant={"outline"} className="cursor-pointer">
            Cancel
          </Button>
        </SheetClose>

        {/* <SheetClose> */}
        <Button className="cursor-pointer bg-primary" disabled={loading} onClick={editTask}>
          {loading ? <Loader2 className="animate-spin" /> : <>Save</>}
        </Button>
        {/* </SheetClose> */}
      </SheetFooter>
    </SheetContent>
  );
}
