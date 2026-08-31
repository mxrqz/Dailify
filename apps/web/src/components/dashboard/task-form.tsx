import { FormEvent, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { dayMap, weekDays, type Repeat } from "@dailify/shared";

import { TASK_LIMITS } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { LinksField } from "@/components/dashboard/links-field";
import { DURATIONS } from "@/components/dashboard/task-meta-menus";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { bareFieldClass } from "@/components/dashboard/styles";
import { priorityText } from "@/consts/conts";
import { useDailify } from "@/components/dailifyContext";
import { useEntitlements } from "@/hooks/useEntitlements";
import { linkLabel } from "@/functions/link-label";
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

/**
 * A folha é uma pilha de páginas, não um formulário de sete campos abertos ao mesmo tempo: a raiz
 * só MOSTRA o que está valendo, e cada linha abre a página do seu campo. É o que cabe numa tela de
 * celular sem espremer controle nenhum — e é por isso que cada página escolhe seu próprio formato
 * (lista pra escolha única, campo com busca pras tags).
 */
export type FormView = "root" | "title" | "links";

/** Título de cada página — quem desenha o cromo da folha lê daqui. */
export const FORM_VIEWS: Record<FormView, { title: string }> = {
  root: { title: copy.form.editTitle },
  title: { title: copy.form.title },
  links: { title: copy.form.links },
};

const REPEAT_MODES = [
  { value: "Off", label: copy.form.repeatOff },
  { value: "Daily", label: copy.form.repeatDaily },
  { value: "Weekly", label: copy.form.repeatWeekly },
  { value: "Monthly", label: copy.form.repeatMonthly },
  { value: "Yearly", label: copy.form.repeatYearly },
];

interface TaskFormProps {
  id: string;
  task?: TaskProps;
  defaultDate?: Date;
  className?: string;
  view: FormView;
  onView: (view: FormView) => void;
  onSubmit: (values: TaskFormValues) => void;
}

/** Uma linha da raiz: o rótulo, o valor de hoje e a seta que leva pra página do campo. */
function SummaryRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 items-center gap-3 rounded-md px-3 text-left transition-colors outline-none hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="font-mono text-2xs tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="ml-auto min-w-0 truncate text-sm text-foreground">{value}</span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

const rowLabelClass = "font-mono text-2xs tracking-[0.04em] text-muted-foreground uppercase";
const rowClass =
  "relative flex h-14 items-center gap-3 rounded-md px-3 transition-colors " +
  "focus-within:bg-surface-hover hover:bg-surface-hover";
/** O controle nativo cobre a linha inteira e é quem recebe o toque; o visual é o de baixo. */
const nativeControlClass = "absolute inset-0 cursor-pointer opacity-0 outline-none";

/**
 * A linha do resumo com um controle NATIVO invisível por cima: no celular o sistema é quem abre o
 * seletor (roda no iOS, folha no Android; calendário no caso da data) — melhor que uma página
 * inteira da drawer pra cinco opções, e de graça em acessibilidade e teclado.
 */
function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (value: string) => void;
}): JSX.Element {
  const current = options.find((option) => option.value === value);
  return (
    <div className={rowClass}>
      <span className={rowLabelClass}>{label}</span>
      <span className="ml-auto min-w-0 truncate text-sm text-foreground">
        {current?.label ?? value}
      </span>
      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={nativeControlClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** `datetime-local`: o calendário e o relógio do próprio aparelho, já no formato e no locale dele. */
function DateRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}): JSX.Element {
  return (
    <div className={rowClass}>
      <span className={rowLabelClass}>{label}</span>
      <span className="ml-auto min-w-0 truncate text-sm text-foreground">
        {/* EEEEEE, não EEE: no locale pt-BR o `EEE` devolve "segunda" por extenso. */}
        {format(value, "EEEEEE · d MMM · HH:mm", { locale: ptBR })}
      </span>
      <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />

      <input
        type="datetime-local"
        aria-label={label}
        // Sem fuso na string: "2026-08-23T09:00" é lido como hora LOCAL nas duas pontas, e um
        // toISOString() aqui adiantaria a tarefa em três horas.
        value={format(value, "yyyy-MM-dd'T'HH:mm")}
        onChange={(e) => {
          const next = new Date(e.target.value);
          if (!Number.isNaN(next.getTime())) onChange(next);
        }}
        className={nativeControlClass}
      />
    </div>
  );
}

export function TaskForm({
  id,
  task,
  defaultDate,
  className,
  view,
  onView,
  onSubmit,
}: TaskFormProps) {
  const { tasks } = useDailify();
  const { recurrence } = useEntitlements();

  const [title, setTitle] = useState(task?.title ?? "");
  const [date, setDate] = useState<Date>(() =>
    task ? new Date(task.date) : (defaultDate ?? new Date()),
  );
  const [duration, setDuration] = useState(task?.duration ?? "10m");
  const [priority, setPriority] = useState(task?.priority ?? 0);
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat ?? "Off");
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  // undefined (nao []) enquanto intocado, pra casar com task.links undefined: [] explicito so
  // depois que o usuario mexe, e o servidor so limpa o campo quando recebe a chave "links".
  const [links, setLinks] = useState<string[] | undefined>(task?.links);

  const repeatMode = typeof repeat === "string" ? repeat : "Weekly";
  const weekly = typeof repeat === "string" ? [] : repeat.Weekly;

  const durations = useMemo(
    () => (DURATIONS.includes(duration) ? DURATIONS : [duration, ...DURATIONS]),
    [duration],
  );

  /** Tags que já existem em outras tarefas: a busca filtra estas antes de oferecer criar uma nova. */
  const knownTags = useMemo(() => {
    const all = new Set<string>();
    for (const t of tasks ?? []) for (const tag of t.tags ?? []) all.add(tag);
    for (const tag of tags) all.add(tag);
    return [...all].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tasks, tags]);

  const [tagDraft, setTagDraft] = useState("");
  const tagsListId = `${id}-tags`;

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagDraft("");
  };

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning(copy.form.titleRequired);
      onView("title");
      return;
    }
    onSubmit({ title: title.trim(), date, duration, priority, tags, repeat, links });
  };

  // Escolha única fecha a página: escolher JÁ é confirmar, e um botão "pronto" só somaria um toque.
  return (
    <form id={id} onSubmit={handleSubmit} noValidate className={cn("flex flex-col", className)}>
      {view === "root" && (
        <div className="flex flex-col">
          <SummaryRow
            label={copy.form.title}
            value={title || copy.form.titlePlaceholder}
            onClick={() => onView("title")}
          />
          <DateRow label={copy.form.date} value={date} onChange={setDate} />
          <SelectRow
            label={copy.form.duration}
            value={duration}
            onChange={setDuration}
            options={durations.map((value) => ({ value, label: value }))}
          />
          <SelectRow
            label={copy.form.priority}
            value={String(priority)}
            onChange={(next) => setPriority(Number(next))}
            options={priorityText.map((label, index) => ({ value: String(index), label }))}
          />
          <SelectRow
            label={copy.form.repeat}
            value={repeatMode}
            onChange={(next) =>
              setRepeat(
                next === "Weekly"
                  ? // Semanal já nasce no dia da própria tarefa: lista vazia não repete nunca.
                    { Weekly: weekly.length ? weekly : [weekDays[date.getDay()]] }
                  : next === "Daily" || next === "Monthly" || next === "Yearly"
                    ? next
                    : "Off",
              )
            }
            options={REPEAT_MODES.map(({ value, label }) => ({
              value,
              label: label + (value !== "Off" && !recurrence ? " (Pro)" : ""),
              disabled: value !== "Off" && !recurrence,
            }))}
          />

          {/* Os dias ficam na própria raiz, não numa página: sem eles "semanal" não diz QUANDO. */}
          {repeatMode === "Weekly" && (
            <div
              role="group"
              aria-label={copy.form.repeatWeekly}
              className="flex gap-1.5 px-3 pb-2"
            >
              {weekDays.map((day) => {
                const on = weekly.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setRepeat({ Weekly: on ? weekly.filter((d) => d !== day) : [...weekly, day] })
                    }
                    className={cn(
                      "size-10 rounded-full border text-sm transition-colors outline-none",
                      "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      on
                        ? "border-accent-primary bg-accent-subtle text-foreground"
                        : "border-surface-line text-content-secondary hover:bg-surface-hover",
                    )}
                  >
                    {copy.form.repeatDays[dayMap[day]]}
                  </button>
                );
              })}
            </div>
          )}
          <SummaryRow
            label={copy.form.links}
            value={
              links?.length
                ? linkLabel(links[0]) + (links.length > 1 ? ` +${links.length - 1}` : "")
                : copy.form.empty
            }
            onClick={() => onView("links")}
          />
          {/* Tags: `<datalist>` — o autocomplete é o do navegador, alimentado pelas tags que você
              já usou nas outras tarefas. Enter adiciona a que estiver escrita, o × tira. */}
          <div className="flex flex-col">
            <div className={rowClass}>
              <span className={rowLabelClass}>{copy.form.tags}</span>
              <input
                list={tagsListId}
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addTag(tagDraft);
                }}
                onBlur={() => addTag(tagDraft)}
                maxLength={TASK_LIMITS.tagMax}
                disabled={tags.length >= TASK_LIMITS.tagsMax}
                placeholder={copy.form.tagSearch}
                aria-label={copy.form.tags}
                className="ml-auto min-w-0 flex-1 bg-transparent text-right text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <datalist id={tagsListId}>
                {knownTags.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </div>

            {tags.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 px-3 pb-3">
                {tags.map((tag) => (
                  <li key={tag}>
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-label={`${copy.form.tags}: ${tag}`}
                      className="flex h-8 items-center gap-1 rounded-full border border-surface-line px-3 text-2xs text-content-secondary transition-colors outline-none hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {tag}
                      <XIcon className="size-3 shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {view === "title" && (
        <div className="flex flex-col">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              onView("root");
            }}
            maxLength={TASK_LIMITS.titleMax}
            placeholder={copy.form.titlePlaceholder}
            aria-label={copy.form.title}
            // Mesma régua do campo de busca: texto puro, e a linha é um Separator.
            className={cn("peer", bareFieldClass)}
          />
          <Separator className="bg-surface-line peer-focus-visible:bg-accent-primary" />
        </div>
      )}

      {view === "links" && (
        <LinksField value={links ?? []} onChange={setLinks} labelledBy={`${id}-links`} />
      )}
    </form>
  );
}
