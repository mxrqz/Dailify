import { useId, useState, type ReactNode } from "react";
import { normalizeRepeat, weekDays, type Repeat } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { LinksField } from "@/components/dashboard/links-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { priorityText, priorityTextColor } from "@/consts/conts";
import { useQuotas } from "@/hooks/useQuotas";
import { cn } from "@/lib/utils";
import { Flag } from "lucide-react";

/**
 * Os editores dos chips do cartão. Cada um recebe o chip como `children` e o usa de gatilho — o
 * Radix já escolhe sozinho o lado com espaço (flip/shift), então não há nada a posicionar aqui.
 *
 * Menu de rádio em vez de `<Select>`: o chip JÁ é o gatilho, então um select aninhado só somaria
 * um segundo clique e o gatilho duplicado dentro do popover.
 */

const menuClass = "min-w-44";

export function PriorityMenu({
  value,
  onChange,
  children,
}: {
  value: number;
  onChange: (priority: number) => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={menuClass}>
        <DropdownMenuRadioGroup
          value={String(value)}
          onValueChange={(next) => onChange(Number(next))}
        >
          {priorityText.map((label, index) => (
            <DropdownMenuRadioItem key={label} value={String(index)}>
              <Flag className={cn("size-3.5", priorityTextColor[index])} aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Duração: os passos que a captura rápida já usa, mais o valor atual quando é um fora da régua. */
export const DURATIONS = ["10m", "15m", "30m", "45m", "1h", "1h30m", "2h"];

export function DurationMenu({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (duration: string) => void;
  children: ReactNode;
}): JSX.Element {
  const options = DURATIONS.includes(value) ? DURATIONS : [value, ...DURATIONS];

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

const REPEATS = [
  { value: "Off", label: copy.form.repeatOff },
  { value: "Daily", label: copy.form.repeatDaily },
  { value: "Weekly", label: copy.form.repeatWeekly },
  { value: "Monthly", label: copy.form.repeatMonthly },
  { value: "Yearly", label: copy.form.repeatYearly },
] as const;

/**
 * "Semanal" aqui vira o dia da semana da própria tarefa — escolher OUTROS dias continua sendo
 * coisa do formulário completo, que é onde cabe a régua de sete botões.
 */
export function RepeatMenu({
  value,
  date,
  onChange,
  children,
}: {
  value: Repeat;
  date: number;
  onChange: (repeat: Repeat) => void;
  children: ReactNode;
}): JSX.Element {
  // `exhausted`, não `blocked`: nenhum plano tem limite 0, então `blocked` nunca é true e o gate
  // seria morto. Aqui é sempre edição de tarefa que existe: se ela já repete, a vaga já é dela.
  const recurrence = !useQuotas().states.recurring.exhausted || value !== "Off";
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
                ? { Weekly: [weekDays[new Date(date).getDay()]] }
                : normalizeRepeat(next),
            );
          }}
        >
          {REPEATS.map(({ value: option, label }) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              disabled={option !== "Off" && !recurrence}
            >
              {label}
              {option !== "Off" && !recurrence && copy.form.repeatLimit}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
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
      <PopoverContent align="end" className="w-auto max-w-80 p-3">
        <span id={labelId} className="sr-only">
          {copy.form.links}
        </span>
        <LinksField value={links} onChange={setLinks} labelledBy={labelId} />
      </PopoverContent>
    </Popover>
  );
}
