import { FormEvent, useEffect, useRef, useState } from "react";
import { TimeValue } from "react-aria-components";
import { toast } from "sonner";
import type { Repeat } from "@dailify/shared";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinksField } from "@/components/dashboard/links-field";
import PriorityPicker from "@/components/ui/priority-picker";
import TagsPicker from "@/components/ui/tags-picker";
import RepeatPicker from "@/components/ui/repeat-picker";
import { DatetimePicker } from "@/components/ui/datetime-picker";
import { DateInput, TimeField } from "@/components/ui/timefield";
import { copy } from "@/components/dashboard/copy";
import { cn } from "@/lib/utils";
import type { TaskProps } from "@/types/types";

export interface TaskFormValues {
  title: string;
  date: Date;
  duration: string;
  priority: number;
  tags?: string[];
  repeat: Repeat;
  links?: string[];
}

interface TaskFormProps {
  id: string;
  task?: TaskProps;
  defaultDate?: Date;
  className?: string;
  onSubmit: (values: TaskFormValues) => void;
}

const labelClass = "font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground";
const fieldClass = "border-surface-line focus-visible:border-accent-primary";
const boxClass =
  "flex h-9 items-center rounded-md border border-surface-line px-2 focus-within:border-accent-primary";

// "10m" and a real task.duration ("1h30m") share the same "Xh Ym" shape, so one parser covers both.
// ponytail: o `as` sobrevive aqui porque TimeValue é uma união de CLASSES do @internationalized/date,
// que não está nas nossas deps (só transitivo). Some no dia em que valer a pena adicioná-lo.
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

export function TaskForm({ id, task, defaultDate, className, onSubmit }: TaskFormProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    task ? new Date(task.date) : (defaultDate ?? new Date()),
  );
  const [selectedDuration, setSelectedDuration] = useState<string>(task ? task.duration : "10m");
  const [priority, setPriority] = useState<number>(0);
  const [tags, setTags] = useState<string[]>();
  const [repeat, setRepeat] = useState<Repeat>();
  // undefined (nao []) enquanto intocado, pra casar com task.links undefined: [] explicito so
  // depois que o usuario mexe, e o servidor so limpa o campo quando recebe a chave "links" (ate
  // que seja []) — mandar `undefined` no envio vira ausencia de chave no JSON e o PATCH ignora.
  const [links, setLinks] = useState<string[] | undefined>(task?.links);

  useEffect(() => {
    if (task || !defaultDate) return;
    setSelectedDate(defaultDate);
  }, [defaultDate, task]);

  const handleDurationChange = (e: TimeValue) => {
    const { hour, minute } = e;
    const finalMessage = `${hour && hour !== 0 ? hour + "h" : ""}${minute && minute !== 0 ? minute + "m" : ""}`;
    setSelectedDuration(finalMessage);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!titleRef.current) return;

    const title = titleRef.current.value.trim();

    if (!title) {
      toast.warning(copy.form.titleRequired);
      return;
    } else if (!selectedDate || !selectedDuration || priority === null || !repeat) {
      toast.warning(copy.form.fieldsRequired);
      return;
    }

    onSubmit({
      title,
      date: selectedDate,
      duration: selectedDuration,
      priority,
      tags,
      repeat,
      links,
    });
  };

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      noValidate
      className={cn("flex flex-col gap-4", className)}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title" className={labelClass}>
          {copy.form.title}
        </Label>
        <Input
          ref={titleRef}
          id="title"
          defaultValue={task?.title}
          type="text"
          placeholder={copy.form.titlePlaceholder}
          className={fieldClass}
          required
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date" className={labelClass}>
            {copy.form.date}
          </Label>

          <DatetimePicker
            value={task ? selectedDate : undefined}
            className="h-9 border border-surface-line focus-within:border-accent-primary"
            onChange={(e) => e && setSelectedDate(e)}
            format={[
              ["months", "days", "years"],
              ["hours", "minutes", "am/pm"],
            ]}
          />
        </div>

        <div className="w-full">
          <TimeField
            aria-label={copy.form.duration}
            id="duration"
            defaultValue={task ? undefined : parseDuration("10m")}
            value={task?.duration ? parseDuration(task.duration) : undefined}
            onChange={(e) => e && handleDurationChange(e)}
            className="flex w-full flex-col gap-1.5"
          >
            <Label htmlFor="duration" className={labelClass}>
              {copy.form.duration}
            </Label>

            <div className={boxClass}>
              <DateInput className="h-8 border-0 p-0 data-[focus-within]:ring-0 data-[focus-within]:ring-offset-0" />
              <span className="ml-auto font-mono text-2xs text-muted-foreground">
                {selectedDuration}
              </span>
            </div>
          </TimeField>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="links" className={labelClass}>
          {copy.form.links}
        </Label>
        <LinksField value={links ?? []} onChange={setLinks} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priority" className={labelClass}>
          {copy.form.priority}
        </Label>
        <PriorityPicker onSelectedPriority={setPriority} task={task} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tags" className={labelClass}>
          {copy.form.tags}
        </Label>
        <TagsPicker onSelectedTags={setTags} task={task} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="repeat" className={labelClass}>
          {copy.form.repeat}
        </Label>
        <RepeatPicker onSelectedRepeat={setRepeat} task={task} />
      </div>
    </form>
  );
}
