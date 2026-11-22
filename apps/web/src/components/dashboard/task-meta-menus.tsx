import { useId, useState, type ReactNode } from "react";
import { normalizeRepeat, weekDays, type Repeat } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { DateTimePicker, TimeWheel } from "@/components/dashboard/date-time-picker";
import { DayPicker } from "@/components/dashboard/day-picker";
import { LinksField } from "@/components/dashboard/links-field";
import { calendarPanel } from "@/components/dashboard/styles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { REPEAT_MODES, everyLabel, everyOptions } from "@/functions/repeat-label";
import { REMINDER_OFFSETS, durationOptions, type ReminderOffset } from "@/functions/task-options";
import { zoned } from "@/functions/zone";

/**
 * Os editores dos chips do composer e da linha do desktop. Cada um recebe o chip como `children` e o usa de gatilho — o
 * Radix já escolhe sozinho o lado com espaço (flip/shift), então não há nada a posicionar aqui.
 *
 * Menu de rádio em vez de `<Select>`: o chip JÁ é o gatilho, então um select aninhado só somaria
 * um segundo clique e o gatilho duplicado dentro do popover.
 */

const menuClass = "min-w-44";

export function DurationMenu({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (duration: string) => void;
  children: ReactNode;
}): JSX.Element {
  const options = durationOptions(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuClass}>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} className="font-mono">
              {option}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NO_REMINDER = "none";

/** The reminder as minutes before the task; `undefined` = none. */
export function ReminderMenu({
  value,
  onChange,
  children,
}: {
  value: ReminderOffset | undefined;
  onChange: (before: ReminderOffset | undefined) => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuClass}>
        <DropdownMenuRadioGroup
          value={value === undefined ? NO_REMINDER : String(value)}
          onValueChange={(next) => onChange(REMINDER_OFFSETS.find((n) => String(n) === next))}
        >
          <DropdownMenuRadioItem value={NO_REMINDER}>{copy.form.noReminder}</DropdownMenuRadioItem>
          {REMINDER_OFFSETS.map((n) => (
            <DropdownMenuRadioItem key={n} value={String(n)}>
              {copy.form.reminderOffsets[n]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * "Semanal" aqui vira o dia da semana da própria tarefa — escolher OUTROS dias continua sendo
 * coisa do formulário completo, que é onde cabe a régua de sete botões.
 */
export function RepeatMenu({
  value,
  every = 1,
  date,
  onChange,
  children,
}: {
  value: Repeat;
  /** `repeatEvery`; o menu sempre devolve um número (1 = sem intervalo). */
  every?: number;
  date: number;
  onChange: (repeat: Repeat, every: number) => void;
  children: ReactNode;
}): JSX.Element {
  const current = typeof value === "string" ? value : "Weekly";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuClass}>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(next) => {
            if (next === current) return;
            // `normalizeRepeat` em vez de assertion: o valor vem como string crua do rádio.
            onChange(
              next === "Weekly"
                ? { Weekly: [weekDays[zoned(date).getDay()]] }
                : normalizeRepeat(next),
              next === "Off" ? 1 : every,
            );
          }}
        >
          {REPEAT_MODES.map(({ value: option, label }) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {current !== "Off" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{copy.form.repeatEvery}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={String(every)}
              onValueChange={(next) => onChange(value, Number(next))}
            >
              {everyOptions(every).map((n) => (
                <DropdownMenuRadioItem key={n} value={String(n)}>
                  {everyLabel(value, n)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Links precisam de teclado dentro do painel (colar URL, editar), então aqui é popover e não menu —
 * item de menu fecha no primeiro clique. O `LinksField` é o mesmo do formulário completo.
 */
export function LinksPopover({
  value,
  onChange,
  children,
}: {
  value: string[];
  onChange: (links: string[]) => void;
  children: ReactNode;
}): JSX.Element {
  const labelId = useId();
  const [links, setLinks] = useState(value);

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setLinks(value);
        // Salva no fechar: enquanto o painel está aberto o usuário ainda está mexendo, e um PATCH
        // por tecla digitada seria uma escrita por caractere.
        else if (JSON.stringify(links) !== JSON.stringify(value)) onChange(links);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-3">
        <span id={labelId} className="sr-only">
          {copy.form.links}
        </span>
        <LinksField value={links} onChange={setLinks} labelledBy={labelId} />
      </PopoverContent>
    </Popover>
  );
}

/** Dia e horário no popover do horário do cartão. Salva no fechar, como o de links. `timeOnly`: só a roda. */
export function DateTimePopover({
  value,
  onChange,
  timeOnly,
  children,
}: {
  value: Date;
  onChange: (date: Date) => void;
  timeOnly?: boolean;
  children: ReactNode;
}): JSX.Element {
  const [date, setDate] = useState(value);

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setDate(value);
        else if (date.getTime() !== value.getTime()) onChange(date);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className={calendarPanel}>
        {timeOnly ? (
          <TimeWheel value={date} onChange={setDate} />
        ) : (
          <DateTimePicker value={date} onChange={setDate} />
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Só o dia: escolher fecha, não há o que ajustar depois. */
export function DayPopover({
  value,
  onChange,
  children,
}: {
  value: Date;
  onChange: (day: Date) => void;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className={calendarPanel}>
        <DayPicker
          value={value}
          onSelect={(day) => {
            onChange(day);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
