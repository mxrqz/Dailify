import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { TimeValue } from "react-aria-components";
import { toast } from "sonner";
import type { Repeat } from "@dailify/shared";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PriorityPicker from "@/components/ui/priority-picker";
import TagsPicker from "@/components/ui/tags-picker";
import RepeatPicker from "@/components/ui/repeat-picker";
import { DatetimePicker } from "@/components/ui/datetime-picker";
import { DateInput, TimeField } from "@/components/ui/timefield";
import type { TaskProps } from "@/types/types";

export interface TaskFormValues {
  title: string;
  description: string;
  date: Date;
  duration: string;
  priority: number;
  tags?: string[];
  repeat: Repeat;
}

export interface TaskFormHandle {
  submit: () => void;
}

interface TaskFormProps {
  task?: TaskProps;
  defaultDate?: Date;
  onSubmit: (values: TaskFormValues) => void;
}

// "10m" and a real task.duration ("1h30m") share the same "Xh Ym" shape, so one parser covers both.
const parseDuration = (duration: string): TimeValue => {
  const hourMatch = duration.match(/(\d+)h/);
  const minuteMatch = duration.match(/(\d+)m/);
  return {
    hour: hourMatch ? parseInt(hourMatch[1]) : 0,
    millisecond: 0,
    minute: minuteMatch ? parseInt(minuteMatch[1]) : 0,
    second: 0,
  } as TimeValue;
};

export const TaskForm = forwardRef<TaskFormHandle, TaskFormProps>(function TaskForm(
  { task, defaultDate, onSubmit },
  ref,
) {
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    task ? new Date(task.date) : (defaultDate ?? new Date()),
  );
  const [selectedDuration, setSelectedDuration] = useState<string>(task ? task.duration : "10m");
  const [priority, setPriority] = useState<number>(0);
  const [tags, setTags] = useState<string[]>();
  const [repeat, setRepeat] = useState<Repeat>();

  useEffect(() => {
    if (task || !defaultDate) return;
    setSelectedDate(defaultDate);
  }, [defaultDate, task]);

  const handleDurationChange = (e: TimeValue) => {
    const { hour, minute } = e;
    const finalMessage = `${hour && hour !== 0 ? hour + "h" : ""}${minute && minute !== 0 ? minute + "m" : ""}`;
    setSelectedDuration(finalMessage);
  };

  const handleSubmit = () => {
    if (!titleRef.current || !descriptionRef.current) return;

    const title = titleRef.current.value;
    const desc = descriptionRef.current.value;

    if (!title) {
      toast.warning("Title is required");
      return;
    } else if (!desc) {
      toast.warning("Description is required");
      return;
    } else if (!selectedDate || !selectedDuration || priority === null || !repeat) {
      toast.warning("All fields are required");
      return;
    }

    onSubmit({
      title,
      description: desc,
      date: selectedDate,
      duration: selectedDuration,
      priority,
      tags,
      repeat,
    });
  };

  useImperativeHandle(ref, () => ({ submit: handleSubmit }));

  return (
    <div
      className={
        task
          ? "flex flex-col gap-4 scrollbar-floating px-5"
          : "flex flex-col gap-4 scrollbar-floating"
      }
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="title">Title</Label>
        <Input
          ref={titleRef}
          id="title"
          defaultValue={task?.title}
          type="text"
          placeholder="Task title"
          className={task ? undefined : "focus-visible:ring-0"}
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="description">Description</Label>
        <Textarea
          ref={descriptionRef}
          id="description"
          defaultValue={task?.description}
          className={task ? "resize-none" : "resize-none focus-visible:ring-0"}
          rows={3}
          maxLength={250}
          placeholder="Task description"
          required={!task}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="date">Date</Label>

          <DatetimePicker
            value={task ? selectedDate : undefined}
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
            defaultValue={task ? undefined : parseDuration("10m")}
            value={task?.duration ? parseDuration(task.duration) : undefined}
            onChange={(e) => e && handleDurationChange(e)}
            className="flex flex-col gap-1 w-full rounded-md"
          >
            <Label htmlFor="duration">Duration</Label>

            <div
              className={
                task
                  ? "flex border rounded-md items-center px-2 focus-within:border-primary"
                  : "flex gap-1 border rounded-md items-center px-2 focus-within:border-primary"
              }
            >
              <DateInput
                className={
                  "border-0 h-9 data-[focus-within]:ring-0 data-[focus-within]:ring-offset-0 p-0"
                }
              />
              {!task && <span>{selectedDuration}</span>}
            </div>
          </TimeField>
        </div>
      </div>

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
  );
});
