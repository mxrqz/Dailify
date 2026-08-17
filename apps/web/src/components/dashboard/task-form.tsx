import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
const boxClass =
  "flex h-9 items-center rounded-md border border-surface-line px-2 focus-within:border-accent-primary";

/**
 * Uma propriedade da tarefa: rótulo estreito à esquerda, controle ocupando o resto. Sete blocos
 * empilhados de "rótulo em cima, campo largo embaixo" gastavam a altura toda e transbordavam a
 * largura da sheet — em linha, cabem sem rolagem e o olho percorre os valores numa coluna só.
 */
function Row({
  label,
  htmlFor,
  labelId,
  children,
}: {
  label: string;
  htmlFor?: string;
  labelId?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex items-start gap-3 py-1">
      <Label htmlFor={htmlFor} id={labelId} className={cn(labelClass, "w-20 shrink-0 pt-2.5")}>
        {label}
      </Label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

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
  // LinksField nao tem um unico controle focavel pra "for" apontar (chips + botao + inputs que
  // trocam); role="group" + aria-labelledby e a associacao correta pra um conjunto assim.
  const linksLabelId = useId();
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

  // O eco do composer, de novo aqui: a mesma frase em mono que o usuário viu ao criar a tarefa.
  const summary = useMemo(
    () =>
      // EEEEEE, não EEE: no locale pt-BR do date-fns, `EEE` devolve "segunda" por extenso.
      [format(selectedDate, "EEEEEE · d MMM · HH:mm", { locale: ptBR }), selectedDuration]
        .filter(Boolean)
        .join(" · "),
    [selectedDate, selectedDuration],
  );

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
      {/* O texto da tarefa é o cabeçalho, não mais um campo rotulado: a sheet já é "a tarefa", e
          um rótulo "TAREFA" acima dele repetia a mesma palavra duas vezes na vertical. */}
      <div className="flex flex-col gap-1">
        <Input
          ref={titleRef}
          id="title"
          defaultValue={task?.title}
          type="text"
          placeholder={copy.form.titlePlaceholder}
          // O FocusScope do Radix chama focus() e, logo depois, select() — abrir o painel
          // deixava a tarefa inteira selecionada, e a próxima tecla a apagaria. Desfazer a
          // seleção precisa acontecer DEPOIS desse select(), daí o frame de espera.
          onFocus={(e) => {
            const el = e.currentTarget;
            requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
          }}
          className="h-auto border-0 bg-transparent px-0 py-0 text-xl font-semibold tracking-[-0.01em] shadow-none focus-visible:border-0 focus-visible:ring-0"
          required
        />

        {/* Mesmo vocabulário dos chips do composer: o que o app entendeu daquela tarefa. */}
        <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {summary}
        </p>
      </div>

      <div className="flex flex-col divide-y divide-surface-line border-y border-surface-line">
        <Row label={copy.form.date}>
          <DatetimePicker
            value={task ? selectedDate : undefined}
            className="h-9 border border-surface-line focus-within:border-accent-primary"
            onChange={(e) => e && setSelectedDate(e)}
            // Ordem e relógio de pt-BR: 17/08/2026 · 16:00, não 08/17/2026 ... PM.
            dtOptions={{ hour12: false }}
            format={[
              ["days", "months", "years"],
              ["hours", "minutes"],
            ]}
          />
        </Row>

        <Row label={copy.form.duration} htmlFor="duration">
          <TimeField
            aria-label={copy.form.duration}
            id="duration"
            defaultValue={task ? undefined : parseDuration("10m")}
            value={task?.duration ? parseDuration(task.duration) : undefined}
            onChange={(e) => e && handleDurationChange(e)}
            className="w-full"
          >
            <div className={boxClass}>
              <DateInput className="h-8 border-0 p-0 data-[focus-within]:ring-0 data-[focus-within]:ring-offset-0" />
              <span className="ml-auto font-mono text-2xs text-muted-foreground">
                {selectedDuration}
              </span>
            </div>
          </TimeField>
        </Row>

        <Row label={copy.form.links} labelId={linksLabelId}>
          <LinksField value={links ?? []} onChange={setLinks} labelledBy={linksLabelId} />
        </Row>

        <Row label={copy.form.priority} htmlFor="priority">
          <PriorityPicker onSelectedPriority={setPriority} task={task} />
        </Row>

        <Row label={copy.form.tags} htmlFor="tags">
          <TagsPicker onSelectedTags={setTags} task={task} />
        </Row>

        <Row label={copy.form.repeat} htmlFor="repeat">
          <RepeatPicker onSelectedRepeat={setRepeat} task={task} />
        </Row>
      </div>
    </form>
  );
}
