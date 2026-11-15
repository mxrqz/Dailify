import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BellIcon,
  CalendarIcon,
  ClockIcon,
  FlagIcon,
  HourglassIcon,
  LinkIcon,
  RepeatIcon,
  SunIcon,
  TagIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_HOUR, dayMap, undatedReminder, weekDays, type Repeat } from "@dailify/shared";

import { TASK_LIMITS } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { LinksField } from "@/components/dashboard/links-field";
import { DURATIONS } from "@/components/dashboard/task-meta-menus";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  bareFieldClass,
  chip,
  chipDate,
  chipGhost,
  chipGot,
  chipRepeat,
  chipTime,
} from "@/components/dashboard/styles";
import { priorityText } from "@/consts/conts";
import { useDailify } from "@/components/dailifyContext";
import { formatClock } from "@/functions/functions";
import { linkLabel } from "@/functions/link-label";
import { everyLabel, everyOptions } from "@/functions/repeat-label";
import { cn } from "@/lib/utils";
import type { TaskProps } from "@/types/types";
import { fromDateInput, zoned, zonedAt } from "@/functions/zone";

export interface TaskFormValues {
  title: string;
  date: Date;
  duration: string;
  priority: number;
  tags?: string[];
  repeat: Repeat;
  /** 1 = sem intervalo. */
  repeatEvery: number;
  links?: string[];
  /** Sem horário: vai para Sem data, e `date` é ignorada. */
  undated: boolean;
  /** Dia do lembrete (às 09:00) de quem está em Sem data; ausente = sem lembrete. */
  reminder?: Date;
}

/**
 * A folha é uma pilha de páginas, não um formulário de sete campos abertos ao mesmo tempo: a raiz
 * só MOSTRA o que está valendo, e cada linha abre a página do seu campo. É o que cabe numa tela de
 * celular sem espremer controle nenhum — e é por isso que cada página escolhe seu próprio formato
 * (lista pra escolha única, campo com busca pras tags).
 */
export type FormView = "root" | "title" | "tags" | "links";

/** Título de cada página — quem desenha o cromo da folha lê daqui. */
export const FORM_VIEWS: Record<FormView, { title: string }> = {
  root: { title: copy.form.editTitle },
  title: { title: copy.form.title },
  tags: { title: copy.form.tags },
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
  /** Avisa quando algo difere do que abriu: a folha só mostra "Salvar" aí. */
  onDirtyChange?: (dirty: boolean) => void;
}

/** O controle NATIVO invisível cobre o chip e recebe o toque: o sistema abre o próprio seletor. */
const nativeControlClass = "absolute inset-0 cursor-pointer opacity-0 outline-none";

const reminderHour = `${String(DEFAULT_HOUR).padStart(2, "0")}:00`;

/** Um campo da raiz como chip: preenchido ganha a cor do campo, vazio fica tracejado. */
function FieldChip({
  icon,
  filled,
  tone = chipGot,
  children,
}: {
  icon: ReactNode;
  filled: boolean;
  tone?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span
      className={cn(
        chip,
        "relative h-8 gap-1.5 px-2.5 focus-within:ring-[3px] focus-within:ring-ring/50",
        filled ? tone : chipGhost,
      )}
    >
      {icon}
      {children}
    </span>
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
  onDirtyChange,
}: TaskFormProps) {
  const { tasks, hour12 } = useDailify();
  const [title, setTitle] = useState(task?.title ?? "");
  const [undated, setUndated] = useState(task?.undated === true);
  const [reminder, setReminder] = useState<Date | undefined>(() =>
    task?.undated && task.alert ? zoned(task.alert) : undefined,
  );
  // Em Sem data a `date` só ordena a lista: a agenda parte do lembrete, ou do próximo 09:00
  // ("Daily" = hoje se ainda não passou, senão amanhã).
  const [date, setDate] = useState<Date>(() => {
    if (!task) return defaultDate ?? zoned();
    if (!task.undated) return zoned(task.date);
    if (task.alert) return zoned(task.alert);
    const now = zoned();
    return undatedReminder(now, "Daily", now) ?? now;
  });
  const [duration, setDuration] = useState(task?.duration ?? "10m");
  const [priority, setPriority] = useState(task?.priority ?? 0);
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat ?? "Off");
  const [every, setEvery] = useState(task?.repeatEvery ?? 1);
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

  const values = JSON.stringify([
    title,
    undated,
    reminder,
    date,
    duration,
    priority,
    repeat,
    every,
    tags,
    links,
  ]);
  const [opened] = useState(values);
  const dirty = values !== opened;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // Mostra o que o salvar grava: 09:00 passado avança na série e some na avulsa.
  const shownReminder = reminder && undatedReminder(reminder, repeat, zoned());
  const icon = "size-3.5 shrink-0";

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
    onSubmit({
      title: title.trim(),
      date,
      duration,
      priority,
      tags,
      repeat,
      repeatEvery: repeat === "Off" ? 1 : every,
      links,
      undated,
      reminder: undated ? reminder : undefined,
    });
  };

  // Escolha única fecha a página: escolher JÁ é confirmar, e um botão "pronto" só somaria um toque.
  return (
    <form id={id} onSubmit={handleSubmit} noValidate className={cn("flex flex-col", className)}>
      {view === "root" && (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={() => onView("title")}
            className={cn(
              "text-left text-2xl font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              !title && "text-muted-foreground",
            )}
          >
            {title || copy.form.titlePlaceholder}
          </button>

          <div className="flex flex-wrap gap-2">
            {undated ? (
              <FieldChip icon={<BellIcon className={icon} />} filled={Boolean(shownReminder)}>
                {shownReminder
                  ? `${format(shownReminder, "EEEEEE · d MMM", { locale: ptBR })} · ${reminderHour}`
                  : copy.form.noReminder}
                <input
                  type="date"
                  aria-label={copy.form.reminder}
                  min={format(zoned(), "yyyy-MM-dd")}
                  value={shownReminder ? format(shownReminder, "yyyy-MM-dd") : ""}
                  onChange={(e) => {
                    const next = fromDateInput(e.target.value);
                    setReminder(Number.isNaN(next.getTime()) ? undefined : next);
                  }}
                  className={nativeControlClass}
                />
              </FieldChip>
            ) : (
              <>
                <FieldChip icon={<CalendarIcon className={icon} />} filled tone={chipDate}>
                  {/* EEEEEE, não EEE: no locale pt-BR o `EEE` devolve "segunda" por extenso. */}
                  {format(date, "EEEEEE · d MMM", { locale: ptBR })}
                  <input
                    type="date"
                    aria-label={copy.form.date}
                    value={format(date, "yyyy-MM-dd")}
                    onChange={(e) => {
                      const next = fromDateInput(e.target.value);
                      if (Number.isNaN(next.getTime())) return;
                      next.setHours(date.getHours(), date.getMinutes());
                      setDate(next);
                    }}
                    className={nativeControlClass}
                  />
                </FieldChip>
                <FieldChip icon={<ClockIcon className={icon} />} filled tone={chipTime}>
                  {formatClock(format(date, "HH:mm"), hour12)}
                  <input
                    type="time"
                    aria-label={copy.form.time}
                    value={format(date, "HH:mm")}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(":").map(Number);
                      if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
                      const next = zoned(date);
                      next.setHours(hours, minutes);
                      setDate(next);
                    }}
                    className={nativeControlClass}
                  />
                </FieldChip>
              </>
            )}

            <FieldChip icon={<HourglassIcon className={icon} />} filled>
              {duration}
              <select
                aria-label={copy.form.duration}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={nativeControlClass}
              >
                {durations.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </FieldChip>

            <FieldChip
              icon={<RepeatIcon className={icon} />}
              filled={repeatMode !== "Off"}
              tone={chipRepeat}
            >
              {repeatMode === "Off"
                ? copy.form.repeat
                : REPEAT_MODES.find((mode) => mode.value === repeatMode)?.label}
              <select
                aria-label={copy.form.repeat}
                value={repeatMode}
                onChange={(e) => {
                  const next = e.target.value;
                  setRepeat(
                    next === "Weekly"
                      ? // Semanal já nasce no dia da própria tarefa: lista vazia não repete nunca.
                        { Weekly: weekly.length ? weekly : [weekDays[date.getDay()]] }
                      : next === "Daily" || next === "Monthly" || next === "Yearly"
                        ? next
                        : "Off",
                  );
                }}
                className={nativeControlClass}
              >
                {REPEAT_MODES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FieldChip>

            {repeatMode !== "Off" && (
              <FieldChip
                icon={<RepeatIcon className={icon} />}
                filled={every > 1}
                tone={chipRepeat}
              >
                {every > 1 ? everyLabel(repeat, every) : copy.form.repeatEvery}
                <select
                  aria-label={copy.form.repeatEvery}
                  value={String(every)}
                  onChange={(e) => setEvery(Number(e.target.value))}
                  className={nativeControlClass}
                >
                  {everyOptions(every).map((n) => (
                    <option key={n} value={String(n)}>
                      {everyLabel(repeat, n)}
                    </option>
                  ))}
                </select>
              </FieldChip>
            )}

            <FieldChip icon={<SunIcon className={icon} />} filled={undated}>
              {copy.form.undatedChip}
              <input
                type="checkbox"
                role="switch"
                aria-label={copy.form.undated}
                checked={undated}
                onChange={(e) => {
                  setUndated(e.target.checked);
                  // O dia escolhido de um lado vira o do outro; a hora da agenda fica.
                  if (e.target.checked) setReminder(date);
                  else if (reminder)
                    setDate(
                      zonedAt(
                        reminder.getFullYear(),
                        reminder.getMonth(),
                        reminder.getDate(),
                        date.getHours(),
                        date.getMinutes(),
                      ),
                    );
                }}
                className={nativeControlClass}
              />
            </FieldChip>

            <FieldChip icon={<FlagIcon className={icon} />} filled={priority > 0}>
              {priority > 0 ? priorityText[priority] : copy.form.priority}
              <select
                aria-label={copy.form.priority}
                value={String(priority)}
                onChange={(e) => setPriority(Number(e.target.value))}
                className={nativeControlClass}
              >
                {priorityText.map((label, index) => (
                  <option key={label} value={String(index)}>
                    {label}
                  </option>
                ))}
              </select>
            </FieldChip>

            <FieldChip icon={<TagIcon className={icon} />} filled={tags.length > 0}>
              {tags.length
                ? tags[0] + (tags.length > 1 ? ` +${tags.length - 1}` : "")
                : copy.form.tags}
              <button
                type="button"
                aria-label={copy.form.tags}
                onClick={() => onView("tags")}
                className={nativeControlClass}
              />
            </FieldChip>

            <FieldChip icon={<LinkIcon className={icon} />} filled={Boolean(links?.length)}>
              {links?.length
                ? linkLabel(links[0]) + (links.length > 1 ? ` +${links.length - 1}` : "")
                : copy.form.links}
              <button
                type="button"
                aria-label={copy.form.links}
                onClick={() => onView("links")}
                className={nativeControlClass}
              />
            </FieldChip>
          </div>

          {/* Os dias ficam na própria raiz, não numa página: sem eles "semanal" não diz QUANDO. */}
          {repeatMode === "Weekly" && (
            <div role="group" aria-label={copy.form.repeatWeekly} className="flex gap-1.5">
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
                      "size-10 rounded-md border text-sm transition-colors outline-none",
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
        </div>
      )}

      {/* Tags: `<datalist>` — o autocomplete é o do navegador, alimentado pelas tags que você já
          usou nas outras tarefas. Enter adiciona a que estiver escrita, o × tira. */}
      {view === "tags" && (
        <div className="flex flex-col gap-3">
          <input
            autoFocus
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
            className={bareFieldClass}
          />
          <datalist id={tagsListId}>
            {knownTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>

          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-label={`${copy.form.tags}: ${tag}`}
                    className="flex h-8 items-center gap-1 rounded-md border border-surface-line px-3 text-2xs text-content-secondary transition-colors outline-none hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {tag}
                    <XIcon className="size-3 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
