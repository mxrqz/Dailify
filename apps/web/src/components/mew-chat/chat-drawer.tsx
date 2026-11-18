import {
  type CSSProperties,
  Fragment,
  type FormEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  EllipsisIcon,
  ImagePlusIcon,
  MicIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { isCalendarEventLink, MEW_IMAGE_MAX, MEW_TEXT_MAX, type Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { DockButton } from "./dock";
import { copy } from "@/components/dashboard/copy";
import { CheckCircle, TaskRow } from "@/components/kit/task-row";
import { Chip } from "@/components/kit/chip";
import { MessageBox } from "@/components/mew/message-box";
import { CalendarBadge } from "@/components/logos";
import { Mew, type MewMood } from "@/components/mew/mew";
import { MewStatic } from "@/components/mew/mew-static";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { spring } from "@/consts/motion";
import { clockAt } from "@/functions/date-label";
import { fill, getCompletionDate } from "@/functions/functions";
import { fromDateInput, zoned } from "@/functions/zone";
import { cn } from "@/lib/utils";

import type { Block, ChatAction, ConfirmBlock, Message, Step } from "./thread";

const t = copy.mewChat;
const THUMB_PX = 320;
const UPLOAD_PX = 1024;
const CHIP_DELAY = 0.1;
const CHIP_STAGGER = 0.05;
const DOT_STAGGER_MS = 150;
const INPUT_ID = "mew-input";

/** "hoje", "amanhã" or the weekday ("sexta-feira"), as the Mew says it. */
function dayName(ms: number): string {
  const day = zoned(ms);
  const now = zoned();
  if (isSameDay(day, now)) return t.todayWord;
  if (isSameDay(day, addDays(now, 1))) return t.tomorrowWord;
  return format(day, "EEEE", { locale: ptBR });
}

const dayOf = (task: Task) => (task.undated ? copy.undated.title : dayName(task.date));
/** "sexta-feira · 10:00". */
const whenOf = (task: Task, hour12: boolean) =>
  task.undated ? dayOf(task) : `${dayOf(task)} · ${clockAt(task.date, hour12)}`;

/** The thread keeps a thumbnail (a full photo would blow the localStorage quota); the upload is bigger. */
export interface Photo {
  thumb: string;
  full: string;
}

function scaled(img: HTMLImageElement, px: number): string {
  const scale = Math.min(1, px / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

async function photoOf(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { thumb: scaled(img, THUMB_PX), full: scaled(img, UPLOAD_PX) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Props = {
  messages: Message[];
  dispatch: (action: ChatAction) => void;
  busy: boolean;
  /** "Créditos de IA · 3 restantes"; `null` when unlimited or not loaded. */
  credits: string | null;
  /** `false`: the LGPD card shows until accepted; `undefined` = not read yet. */
  consent: boolean | undefined;
  onConsent: () => void;
  onSend: (text: string) => void;
  onPhoto: () => void;
  onCompose: () => void;
  onOpenTask: (task: Task) => void;
};

const isConfirm = (b: Block): b is ConfirmBlock => b.kind === "confirm";

/** The header Mew reacts to the latest turn: thinks, waits for a confirmation, cheers, gets lost. */
export function moodOf(last: Message | undefined, busy: boolean): MewMood {
  if (last?.from !== "mew") return busy ? "thinking" : "idle";
  if (last.typing) return "thinking";
  const step = last.blocks.filter(isConfirm).at(-1)?.step;
  if (step === "draft") return "alert";
  if (step === "done") return "happy";
  if (last.intent === "notFound" || last.intent === "unsupported") return "confused";
  return "idle";
}

/** Near-full-height, non-modal sheet under the dock, which becomes its message box (`ChatInput`). */
export function ChatDrawer({
  open,
  onOpenChange,
  ...props
}: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(INPUT_ID)?.focus();
        }}
        // Typing in the dock is not leaving the chat.
        onInteractOutside={(event) => {
          if (event.target instanceof Element && event.target.closest('[data-slot="create-dock"]'))
            event.preventDefault();
        }}
        className="z-chat h-11/12 px-0 pb-0 sm:mx-auto sm:w-sheet"
      >
        <ChatPanel {...props} />
      </SheetContent>
    </Sheet>
  );
}

function ChatPanel({
  messages,
  dispatch,
  busy,
  credits,
  consent,
  onConsent,
  onSend,
  onPhoto,
  onCompose,
  onOpenTask,
}: Props) {
  const log = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  // What was already there when the chat opened shows up as is; only new messages and blocks enter.
  const [initial] = useState(() => new Set(messages.map((m) => m.id)));

  // The only writer of scrollTop: glued to the newest message while it grows (rows opening, morphs),
  // unless scrolled up. Instant, so it never fights the animation.
  useEffect(() => {
    const el = log.current;
    const inner = list.current;
    if (!el || !inner) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    };
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(inner);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // A new message re-pins; the observer above scrolls as its row opens.
  useLayoutEffect(() => {
    pinned.current = true;
  }, [messages.length]);

  return (
    <>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t.menu} className="justify-self-start">
              <EllipsisIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onCompose}>{copy.composer.open}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => dispatch({ type: "clear" })}>
              {t.clear}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col items-center">
          <Mew mood={moodOf(messages.at(-1), busy)} className="w-14" />
          <SheetTitle className="sr-only">{t.title}</SheetTitle>
          <p aria-live="polite" className="sr-only">
            {busy ? t.thinking : ""}
          </p>
          {credits !== null && (
            <p className="mt-1 text-footnote text-ink-secondary tabular-nums">{credits}</p>
          )}
        </div>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" aria-label={t.close} className="justify-self-end">
            <XIcon aria-hidden="true" />
          </Button>
        </SheetClose>
      </header>

      {/* Newest at the bottom, against the dock; older ones scroll up under the fade. */}
      <div
        ref={log}
        role="log"
        aria-label={t.thread}
        className="fade-top flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4"
      >
        <div ref={list} className="flex grow flex-col justify-end pt-6 pb-dock-clear">
          {messages.length === 0 && consent !== false && (
            <Empty onPick={onSend} onPhoto={onPhoto} onCompose={onCompose} />
          )}
          {messages.map((m) => {
            const fresh = !initial.has(m.id);
            return (
              <Reveal key={m.id} enter={fresh} className="py-1.5">
                {m.from === "me" ? (
                  <Mine message={m} />
                ) : (
                  <Reply message={m} fresh={fresh} dispatch={dispatch} onOpenTask={onOpenTask} />
                )}
              </Reveal>
            );
          })}
          {consent === false && <Consent onAccept={onConsent} />}
        </div>
      </div>
    </>
  );
}

/**
 * The dock's pill while the chat is open (`CreateDock chat={…}`): attach, field and one round
 * button that is the mic when empty (opens the voice composer) and send with text.
 */
export function ChatInput({
  busy,
  offline,
  onSend,
  onVoice,
  file,
}: {
  busy: boolean;
  offline: boolean;
  onSend: (text: string, image?: Photo) => void;
  onVoice?: () => void;
  file: RefObject<HTMLInputElement>;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<Photo>();
  const filled = !!text.trim() || !!image;
  const mic = !filled && !!onVoice;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || offline || !filled) return;
    onSend(text.trim(), image);
    setText("");
    setImage(undefined);
  };

  const pick = async (picked: File) => {
    const photo = await photoOf(picked).catch(() => undefined);
    if (!photo) return;
    if (photo.full.length > MEW_IMAGE_MAX) toast.error(t.tooBig);
    else setImage(photo);
  };

  return (
    <form onSubmit={submit} className="flex h-full min-w-0 flex-1 items-center gap-1">
      {image && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.soft}
          className="absolute bottom-full left-1 mb-3"
        >
          <img
            src={image.thumb}
            alt={t.photo}
            className="h-16 rounded-md object-cover shadow-raised"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.removeImage}
            onClick={() => setImage(undefined)}
            className="absolute -top-5 -right-5 rounded-full hover:bg-transparent"
          >
            <span className="grid size-6 place-items-center rounded-full bg-ink text-canvas">
              <XIcon aria-hidden="true" className="size-3.5" />
            </span>
          </Button>
        </motion.div>
      )}
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (picked) void pick(picked);
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.attach}
        onClick={() => file.current?.click()}
        className="rounded-full text-ink-secondary hover:text-ink"
      >
        <ImagePlusIcon aria-hidden="true" />
      </Button>
      {/* text-body: below 16px iOS zooms the page on focus. */}
      <input
        id={INPUT_ID}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={offline ? t.offline : t.placeholder}
        aria-label={t.placeholder}
        maxLength={MEW_TEXT_MAX}
        enterKeyHint="send"
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-secondary"
      />
      <DockButton
        type={mic ? "button" : "submit"}
        aria-label={mic ? t.mic : t.send}
        disabled={!mic && (busy || offline || !filled)}
        onClick={mic ? onVoice : undefined}
        className={cn(filled && "bg-brand text-on-brand")}
      >
        <MicIcon
          aria-hidden="true"
          className={cn(
            "absolute size-5 transition-[opacity,scale] duration-fast",
            !mic && "scale-60 opacity-0",
          )}
        />
        <ArrowUpIcon
          aria-hidden="true"
          className={cn(
            "absolute size-5 transition-[opacity,scale] duration-fast",
            mic && "scale-60 opacity-0",
          )}
        />
      </DockButton>
    </form>
  );
}

function Empty({
  onPick,
  onPhoto,
  onCompose,
}: {
  onPick: (text: string) => void;
  onPhoto: () => void;
  onCompose: () => void;
}) {
  const s = t.suggestions;
  const chips = [
    ...[s.today, s.overdue, s.steps].map((label) => ({
      label,
      icon: undefined,
      onClick: () => onPick(label),
    })),
    { label: s.photo, icon: <ImagePlusIcon aria-hidden="true" />, onClick: onPhoto },
    { label: copy.composer.open, icon: <PlusIcon aria-hidden="true" />, onClick: onCompose },
  ];
  return (
    <div className="my-auto flex flex-col items-center px-4 text-center">
      <MewStatic mood="happy" className="w-20" />
      <p className="mt-4 text-title-3 font-semibold">{t.emptyTitle}</p>
      <p className="mt-1 text-subhead text-ink-secondary">{t.emptyHint}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {chips.map((chip, i) => (
          <motion.span
            key={chip.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.soft, delay: CHIP_DELAY + i * CHIP_STAGGER }}
          >
            <Chip icon={chip.icon} onClick={chip.onClick}>
              {chip.label}
            </Chip>
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/** LGPD: nothing reaches OpenAI before this. */
function Consent({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="my-auto flex flex-col items-center px-4 py-6 text-center">
      <MewStatic className="w-20" />
      <p className="mt-4 text-title-3 font-semibold">{t.consentTitle}</p>
      <p className="mt-1 text-subhead text-ink-secondary">{t.consentBody}</p>
      <Button onClick={onAccept} className="mt-6">
        {t.consentAccept}
      </Button>
    </div>
  );
}

/** `.mine`: accent bubble, tight corner at the bottom right, never wider than `max-w-bubble`. */
function Mine({ message }: { message: Extract<Message, { from: "me" }> }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {message.image && (
        <img
          src={message.image}
          alt={t.photo}
          className="max-h-40 max-w-bubble rounded-lg rounded-br-xs object-cover"
        />
      )}
      {message.text && (
        <p className="max-w-bubble rounded-lg rounded-br-xs bg-brand px-3.5 py-2 text-subhead text-on-brand">
          {message.text}
        </p>
      )}
    </div>
  );
}

// Decorative: the header's live region already says "Pensando…".
function Dots() {
  return (
    <span aria-hidden="true" className="inline-flex h-5 items-center gap-0.75">
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          className="size-1.5 animate-dot rounded-full bg-ink-tertiary motion-reduce:animate-none"
          style={{ animationDelay: `${i * DOT_STAGGER_MS}ms` }}
        />
      ))}
    </span>
  );
}

/** Steps that close a confirmation: the whole message morphs to them (MessageBox). */
const FINAL: Step[] = ["done", "cancelled", "undone"];

/** `--i` staggers a word (`word-in`), `--words` delays what follows the text (`delay-words`). */
const cssVar = (name: "--i" | "--words", n: number): CSSProperties & Record<string, number> => ({
  [name]: n,
});

/**
 * One Mew message = one container (ears on top): the text, then each block opens under it, its
 * buttons at the foot. Typing → text and a confirmation closing morph the whole box.
 */
function Reply({
  message,
  fresh,
  dispatch,
  onOpenTask,
}: {
  message: Extract<Message, { from: "mew" }>;
  fresh: boolean;
  dispatch: (action: ChatAction) => void;
  onOpenTask: (task: Task) => void;
}) {
  const confirm = message.blocks.find(isConfirm);
  const key = message.typing
    ? "typing"
    : confirm && FINAL.includes(confirm.step)
      ? confirm.step
      : "text";
  const words = message.text.split(" ");
  return (
    <div className="flex items-end gap-2">
      <MewStatic happy={confirm?.step === "done"} className="mb-0.5 w-6.5 flex-none" />
      <MessageBox type="text" contentKey={key} className="max-w-bubble">
        {message.typing ? (
          <Dots />
        ) : (
          <>
            {/* Every word is in the DOM at once, so the box morphs to its final size. */}
            <p className="min-h-2lh text-subhead">
              {words.map((word, i) => (
                <Fragment key={i}>
                  {i > 0 && " "}
                  <span className={cn("inline-block", fresh && "word-in")} style={cssVar("--i", i)}>
                    {word}
                  </span>
                </Fragment>
              ))}
            </p>
            {message.blocks.map((block, i) => (
              <Reveal
                key={i}
                enter={fresh && (block.kind === "tasks" || !FINAL.includes(block.step))}
                words={words.length}
                className="pt-2.5"
              >
                {block.kind === "tasks" ? (
                  <ul className="flex flex-col gap-1.5">
                    {block.tasks.map((task) => (
                      <li key={`${task.id}-${task.date}`}>
                        <Row task={task} onOpen={() => onOpenTask(task)} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ConfirmBody block={block} dispatch={dispatch} />
                )}
              </Reveal>
            ))}
          </>
        )}
      </MessageBox>
    </div>
  );
}

// Opens its own height on mount (grid rows 0fr → 1fr via `@starting-style`) while the content fades up.
function Reveal({
  enter,
  words,
  className,
  children,
}: {
  enter: boolean;
  /** Under a reply: wait for its last word. */
  words?: number;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      style={words ? cssVar("--words", words) : undefined}
      className={cn(
        "grid flex-none grid-rows-[1fr]",
        enter &&
          "transition-[grid-template-rows] delay-words duration-open ease-out-quint starting:grid-rows-[0fr] motion-reduce:transition-none",
      )}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden",
          enter &&
            "transition-[opacity,translate] delay-words-lag duration-slow ease-out starting:translate-y-2.5 starting:opacity-0 motion-reduce:transition-none",
        )}
      >
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}

/** A task as the agenda shows it; `meta` replaces the day line. */
function Row({ task, meta, onOpen }: { task: Task; meta?: ReactNode; onOpen?: () => void }) {
  const { hour12 } = useDailify();
  const calendar = task.links?.some(isCalendarEventLink);
  return (
    <TaskRow
      time={task.undated ? "" : clockAt(task.date, hour12)}
      title={task.title}
      done={getCompletionDate(task, zoned(task.date)) === true}
      meta={
        meta ?? (
          <>
            {calendar && <CalendarBadge />}
            <span className="truncate">
              {[dayOf(task), calendar && copy.calendar.name].filter(Boolean).join(" · ")}
            </span>
          </>
        )
      }
      onOpen={onOpen}
    />
  );
}

function ConfirmBody({
  block,
  dispatch,
}: {
  block: ConfirmBlock;
  dispatch: (action: ChatAction) => void;
}) {
  const { hour12 } = useDailify();
  const b = t.box;
  const { action, step } = block;
  const picked = block.after.filter((x) => !block.off.includes(x.id));
  const n = action === "delete" || action === "move" ? block.before.length : picked.length;
  // A move's label is its target day ("2026-11-21"); a steps' label, the parent title.
  const day = action === "move" && block.label ? dayName(+fromDateInput(block.label)) : "";
  const values = { n, day, task: block.label ?? "" };

  if (step === "cancelled" || step === "undone")
    return (
      <p className="text-subhead text-ink-secondary">
        {step === "cancelled" ? b.cancelled : b.undone}
      </p>
    );

  if (step === "done") {
    const summary = (action === "delete" ? block.before : block.after)
      .map((x) => x.title)
      .join(", ");
    const doneText = {
      move: b.moved,
      create: b.created,
      steps: b.added,
      event: b.scheduled,
      delete: b.removed,
    }[action];
    return (
      <>
        <div className="flex items-center gap-1.5 text-subhead font-semibold text-brand-text">
          <CheckIcon aria-hidden="true" className="size-4" strokeWidth={2.6} />
          {fill(doneText, values)}
        </div>
        <p className="mt-1.5 truncate border-l-2 border-separator pl-2.5 text-footnote text-ink-secondary">
          {summary}
        </p>
        <div className="mt-2.5 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => dispatch({ type: "undo", block: block.id })}
          >
            {b.undo}
          </Button>
        </div>
      </>
    );
  }

  const head = {
    move: [b.move, b.moveSource],
    create: [b.create, b.createSource],
    steps: [b.steps, b.stepsSource],
    event: [b.event, b.eventSource],
    delete: [b.remove, b.removeSource],
  }[action];
  const cta = {
    move: b.confirm,
    create: b.createN,
    steps: b.addN,
    event: b.createEvent,
    delete: b.removeN,
  }[action];

  return (
    <>
      <div className="mb-2.5">
        <b className="block text-subhead font-semibold">{fill(head[0], values)}</b>
        <span className="text-footnote text-ink-secondary">{head[1]}</span>
      </div>
      {action === "create" || action === "steps" ? (
        <ul className="flex flex-col divide-y divide-separator rounded-md bg-fill px-3">
          {block.after.map((task) => {
            const on = !block.off.includes(task.id);
            const toggle = () => dispatch({ type: "toggle", block: block.id, task: task.id });
            return (
              <li key={task.id} className="-ml-3 flex items-center">
                <CheckCircle
                  checked={on}
                  onCheckedChange={toggle}
                  label={fill(b.include, { title: task.title })}
                />
                <span className={cn("flex min-w-0 flex-1 flex-col py-2", !on && "opacity-50")}>
                  {action === "create" ? (
                    <input
                      value={task.title}
                      aria-label={b.editTitle}
                      onChange={(event) =>
                        dispatch({
                          type: "edit",
                          block: block.id,
                          task: task.id,
                          title: event.target.value,
                        })
                      }
                      className="min-w-0 bg-transparent text-body font-semibold outline-none"
                    />
                  ) : (
                    <span className="text-subhead font-medium">{task.title}</span>
                  )}
                  {action === "create" && (
                    <span className="text-footnote text-ink-secondary tabular-nums">
                      {whenOf(task, hour12)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {(action === "delete" ? block.before : block.after).map((task) => {
            const was = block.before.find((x) => x.id === task.id);
            return (
              <li key={task.id}>
                <Row
                  task={task}
                  meta={
                    action === "move" && was ? (
                      <>
                        <s className="text-ink-tertiary">{whenOf(was, hour12)}</s>
                        <ArrowRightIcon aria-hidden="true" />
                        <span className="text-ink">{dayOf(task)}</span>
                      </>
                    ) : action === "event" ? (
                      <>
                        <CalendarBadge />
                        <span>{dayOf(task)}</span>
                      </>
                    ) : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => dispatch({ type: "cancel", block: block.id })}
        >
          {b.cancel}
        </Button>
        <Button
          size="sm"
          disabled={!n}
          onClick={() => dispatch({ type: "confirm", block: block.id })}
        >
          {fill(cta, values)}
        </Button>
      </div>
    </>
  );
}
