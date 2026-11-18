import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { addDays, addMinutes, format, isSameDay } from "date-fns";
import {
  BellIcon,
  CalendarIcon,
  ClockIcon,
  FlagIcon,
  LinkIcon,
  Repeat2Icon,
  RepeatIcon,
  SunIcon,
  TagIcon,
  TimerIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_DURATION,
  DEFAULT_HOUR,
  TASK_LIMITS,
  dayMap,
  durationMinutes,
  isCalendarEventLink,
  meetLink,
  normalizeRepeat,
  undatedReminder,
  videoLink,
  weekDays,
  type Repeat,
} from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { LinksField, MeetEditor } from "@/components/dashboard/links-field";
import { Chip } from "@/components/kit/chip";
import { ListGroup, ListRow } from "@/components/kit/list";
import { Switch } from "@/components/kit/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { priorityText } from "@/consts/conts";
import { clockAt, dayComma } from "@/functions/date-label";
import { fill } from "@/functions/functions";
import { linkHost, linkLabel } from "@/functions/link-label";
import { REPEAT_MODES, everyLabel, everyOptions, repeatLabel } from "@/functions/repeat-label";
import { durationOptions } from "@/functions/task-options";
import { cn } from "@/lib/utils";
import type { Task } from "@dailify/shared";
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
export type FormView = "root" | "title" | "tags" | "links" | "meet";

/** Título de cada página — quem desenha o cromo da folha lê daqui. */
export const FORM_VIEWS: Record<FormView, { title: string }> = {
  root: { title: copy.form.editTitle },
  title: { title: copy.form.title },
  tags: { title: copy.form.tags },
  links: { title: copy.form.links },
  meet: { title: copy.form.meet },
};

interface TaskFormProps {
  id: string;
  task?: Task;
  defaultDate?: Date;
  className?: string;
  view: FormView;
  onView: (view: FormView) => void;
  onSubmit: (values: TaskFormValues) => void;
  /** Avisa quando algo difere do que abriu: a folha só mostra "Salvar" aí. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Tags das outras tarefas: a busca as oferece antes de criar uma nova. */
  knownTags?: string[];
  hour12?: boolean;
  /** Grupos extras no fim da raiz (o do Google Agenda), dentro da mesma rolagem. */
  children?: ReactNode;
  /** Convite da Agenda que só o organizador muda: título, data, hora, duração e repetição travados. */
  locked?: boolean;
  /**
   * Tarefa na Agenda que a pessoa pode mudar: o Meet abre o editor da sala. Gera a sala nova já no
   * Google e devolve os links da tarefa (undefined = falhou, o aviso é de quem chama).
   */
  onNewMeet?: () => Promise<string[] | undefined>;
}

/** O controle NATIVO invisível cobre a linha e recebe o toque: o sistema abre o próprio seletor. */
const nativeControlClass = "absolute inset-0 cursor-pointer opacity-0 outline-none";

const reminderHour = `${String(DEFAULT_HOUR).padStart(2, "0")}:00`;

// Frameless field, text only: the line under it is a sibling `Separator`.
const bareFieldClass =
  "h-11 rounded-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:border-0 focus-visible:ring-0";

/** Uma linha da lista com o controle nativo por cima: a linha mostra o valor, o sistema escolhe. */
function NativeRow({
  control,
  disabled,
  ...row
}: Omit<ComponentProps<typeof ListRow>, "asChild" | "children"> & { control: ReactNode }) {
  return (
    <ListRow asChild accessory={disabled ? undefined : "chevron"} {...row}>
      <div className="relative pointer-fine:focus-within:bg-fill">{control}</div>
    </ListRow>
  );
}

function WeekdayToggle({
  value,
  disabled,
  onChange,
}: {
  value: string[];
  disabled: boolean;
  onChange: (days: string[]) => void;
}) {
  return (
    <div
      role="group"
      aria-label={copy.form.repeatWeekly}
      className="flex justify-between border-t border-separator px-3.5 py-3"
    >
      {weekDays.map((day) => {
        const on = value.includes(day);
        return (
          <Chip
            key={day}
            variant="select"
            size="square"
            pressed={on}
            disabled={disabled}
            onClick={() => {
              // The last day stays: an empty Weekly is saved as "Off" and the series stops.
              if (on && value.length === 1) return;
              onChange(on ? value.filter((d) => d !== day) : [...value, day]);
            }}
          >
            {copy.form.repeatDays[dayMap[day]]}
          </Chip>
        );
      })}
    </div>
  );
}

/**
 * Tags: a `<datalist>`, so the autocomplete is the browser's, fed by the tags of the other tasks.
 * Enter adds what is typed; tapping a tag removes it.
 */
function TagsView({
  listId,
  tags,
  known,
  onAdd,
  onRemove,
}: {
  listId: string;
  tags: string[];
  known: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const tag = draft.trim();
    if (!tag) return;
    onAdd(tag);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        autoFocus
        list={listId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          add();
        }}
        onBlur={add}
        maxLength={TASK_LIMITS.tagMax}
        disabled={tags.length >= TASK_LIMITS.tagsMax}
        placeholder={copy.form.tagSearch}
        aria-label={copy.form.tags}
        className={bareFieldClass}
      />
      <datalist id={listId}>
        {known.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <Chip
                variant="select"
                size="sm"
                aria-label={fill(copy.form.tagRemove, { tag })}
                onClick={() => onRemove(tag)}
                className="gap-1"
              >
                {tag}
                <XIcon className="size-3" aria-hidden="true" />
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const NO_TAGS: string[] = [];

export function TaskForm({
  id,
  task,
  defaultDate,
  className,
  view,
  onView,
  onSubmit,
  onDirtyChange,
  knownTags: otherTags = NO_TAGS,
  hour12 = false,
  children,
  locked = false,
  onNewMeet,
}: TaskFormProps) {
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
  const [duration, setDuration] = useState(task?.duration ?? DEFAULT_DURATION);
  const [priority, setPriority] = useState(task?.priority ?? 0);
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat ?? "Off");
  const [every, setEvery] = useState(task?.repeatEvery ?? 1);
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  // undefined (nao []) enquanto intocado, pra casar com task.links undefined: [] explicito so
  // depois que o usuario mexe, e o servidor so limpa o campo quando recebe a chave "links".
  const [links, setLinks] = useState<string[] | undefined>(task?.links);
  // O evento do Google também mora em `links`: o campo só edita o link da tarefa, e trocá-lo não
  // pode desvincular a agenda.
  const calendarLinks = links?.filter(isCalendarEventLink) ?? [];
  const ownLinks = links?.filter((url) => !isCalendarEventLink(url)) ?? [];
  const link = ownLinks[0];
  const meet = onNewMeet && link && meetLink([link]);
  const [meetPending, setMeetPending] = useState(false);

  const repeatMode = typeof repeat === "string" ? repeat : "Weekly";
  const weekly = typeof repeat === "string" ? [] : repeat.Weekly;

  const durations = durationOptions(duration);

  /** Tags que já existem em outras tarefas: a busca filtra estas antes de oferecer criar uma nova. */
  const knownTags = useMemo(
    () => [...new Set([...otherTags, ...tags])].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [otherTags, tags],
  );

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
  ]);
  const [opened] = useState(values);
  // Os links à parte: o Meet novo já foi salvo no servidor, e não pode acender o "Salvar".
  const [savedLinks, setSavedLinks] = useState(task?.links);
  const dirty = values !== opened || JSON.stringify(links) !== JSON.stringify(savedLinks);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  // Mostra o que o salvar grava: 09:00 passado avança na série e some na avulsa.
  const shownReminder = reminder && undatedReminder(reminder, repeat, zoned());
  const clock = (at: Date) => clockAt(at, hour12);
  const now = zoned();
  // "Amanhã, 15:00 às 16:00": o fim sai da duração, como no evento do Google.
  const when = undated
    ? copy.form.undatedChip
    : fill(copy.form.when, {
        day: isSameDay(date, now)
          ? copy.day.today
          : isSameDay(date, addDays(now, 1))
            ? copy.day.tomorrow
            : dayComma(date),
        start: clock(date),
        end: clock(addMinutes(date, durationMinutes(duration))),
      });
  const repeatValue =
    repeatMode === "Weekly" && weekly.length
      ? fill(copy.form.repeatWeeklyDays, { days: repeatLabel({ Weekly: weekly }) })
      : REPEAT_MODES.find((mode) => mode.value === repeatMode)?.label;
  const linkName = link ? linkLabel(link) : copy.form.links;
  const host = link ? linkHost(link) : "";

  const generateMeet = async () => {
    setMeetPending(true);
    const next = await onNewMeet?.();
    setMeetPending(false);
    if (!next) return;
    setLinks(next);
    setSavedLinks(next);
    onView("root");
  };

  const toggleUndated = (next: boolean) => {
    setUndated(next);
    // O dia escolhido de um lado vira o do outro; a hora da agenda fica.
    if (next) setReminder(date);
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
  };

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
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5 px-1 pt-3 pr-10 pb-1">
            <button
              type="button"
              onClick={() => onView("title")}
              disabled={locked}
              className={cn(
                "self-start rounded-xs text-left text-title-3 font-semibold focus-ring",
                !title && "text-ink-secondary",
              )}
            >
              {title || copy.form.titlePlaceholder}
            </button>
            <p className="text-subhead text-ink-secondary tabular-nums">{when}</p>
            {locked && <p className="text-footnote text-ink-secondary">{copy.calendar.readonly}</p>}
          </div>

          <ListGroup compact>
            {!undated && (
              <>
                <NativeRow
                  icon={<CalendarIcon />}
                  label={copy.form.date}
                  disabled={locked}
                  value={dayComma(date)}
                  control={
                    <input
                      type="date"
                      aria-label={copy.form.date}
                      disabled={locked}
                      value={format(date, "yyyy-MM-dd")}
                      onChange={(e) => {
                        const next = fromDateInput(e.target.value);
                        if (Number.isNaN(next.getTime())) return;
                        next.setHours(date.getHours(), date.getMinutes());
                        setDate(next);
                      }}
                      className={nativeControlClass}
                    />
                  }
                />
                <NativeRow
                  icon={<ClockIcon />}
                  label={copy.form.time}
                  disabled={locked}
                  value={clock(date)}
                  control={
                    <input
                      type="time"
                      aria-label={copy.form.time}
                      disabled={locked}
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
                  }
                />
              </>
            )}
            <NativeRow
              icon={<TimerIcon />}
              label={copy.form.duration}
              disabled={locked}
              value={duration}
              control={
                <select
                  aria-label={copy.form.duration}
                  disabled={locked}
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
              }
            />
            <ListRow
              icon={<SunIcon />}
              label={copy.form.undated}
              trailing={
                <Switch
                  aria-label={copy.form.undated}
                  checked={undated}
                  onCheckedChange={toggleUndated}
                  disabled={locked}
                />
              }
            />
          </ListGroup>

          <ListGroup compact>
            {/* Lembrete à parte só em Sem data: na agenda o alerta é a própria hora da tarefa. */}
            {undated && (
              <NativeRow
                icon={<BellIcon />}
                label={copy.form.reminder}
                value={
                  shownReminder
                    ? fill(copy.form.reminderValue, {
                        day: dayComma(shownReminder),
                        time: reminderHour,
                      })
                    : copy.form.noReminder
                }
                control={
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
                }
              />
            )}
            <NativeRow
              icon={<RepeatIcon />}
              label={copy.form.repeat}
              disabled={locked}
              value={repeatValue}
              control={
                <select
                  aria-label={copy.form.repeat}
                  disabled={locked}
                  value={repeatMode}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRepeat(
                      next === "Weekly"
                        ? // Semanal já nasce no dia da própria tarefa: lista vazia não repete nunca.
                          { Weekly: weekly.length ? weekly : [weekDays[date.getDay()]] }
                        : normalizeRepeat(next),
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
              }
            />
            {repeatMode !== "Off" && (
              <NativeRow
                icon={<Repeat2Icon />}
                label={copy.form.repeatEvery}
                disabled={locked}
                value={everyLabel(repeat, every)}
                control={
                  <select
                    aria-label={copy.form.repeatEvery}
                    disabled={locked}
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
                }
              />
            )}
            {/* Os dias ficam na própria raiz, não numa página: sem eles "semanal" não diz QUANDO. */}
            {repeatMode === "Weekly" && (
              <WeekdayToggle
                value={weekly}
                disabled={locked}
                onChange={(days) => setRepeat({ Weekly: days })}
              />
            )}
          </ListGroup>

          <ListGroup compact>
            <NativeRow
              icon={<FlagIcon />}
              label={copy.form.priority}
              value={priorityText[priority]}
              control={
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
              }
            />
            <ListRow
              icon={<TagIcon />}
              label={copy.form.tags}
              aria-label={copy.form.tags}
              accessory="chevron"
              onClick={() => onView("tags")}
              trailing={
                tags.length > 0 && (
                  <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                    {tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="flex h-6.5 flex-none items-center rounded-full bg-fill px-2.5 text-footnote font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                    {tags.length > 2 && (
                      <span className="text-footnote text-ink-secondary">
                        {fill(copy.form.moreTags, { n: tags.length - 2 })}
                      </span>
                    )}
                  </span>
                )
              }
            />
            <ListRow
              icon={link && videoLink([link]) ? <VideoIcon /> : <LinkIcon />}
              label={linkName}
              aria-label={copy.form.links}
              value={host && host !== linkName ? host : undefined}
              accessory="chevron"
              onClick={() => onView(meet ? "meet" : "links")}
            />
          </ListGroup>

          {children}
        </div>
      )}

      {view === "tags" && (
        <TagsView
          listId={`${id}-tags`}
          tags={tags}
          known={knownTags}
          onAdd={(tag) => setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]))}
          onRemove={(tag) => setTags((prev) => prev.filter((t) => t !== tag))}
        />
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
          <Separator className="bg-separator peer-focus-visible:bg-brand" />
        </div>
      )}

      {view === "meet" && meet && (
        <MeetEditor
          value={meet}
          pending={meetPending}
          onChange={(next) => setLinks(links?.map((l) => (l === meet ? next : l)))}
          onRemove={() => {
            setLinks(links?.filter((l) => l !== meet));
            onView("root");
          }}
          onNew={() => void generateMeet()}
        />
      )}

      {view === "links" && (
        <LinksField
          value={ownLinks}
          onChange={(next) => setLinks([...next, ...calendarLinks])}
          labelledBy={`${id}-links`}
        />
      )}
    </form>
  );
}
