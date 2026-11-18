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
import { format } from "date-fns";
import {
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  EllipsisIcon,
  ImagePlusIcon,
  MicIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { motion } from "motion/react";

import { copy } from "@/components/dashboard/copy";
import { CheckCircle } from "@/components/dashboard/day-task-row";
import { Chip } from "@/components/kit/chip";
import { MessageBox } from "@/components/landing/kit/message-box";
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
import { zoned } from "@/functions/zone";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { cn } from "@/lib/utils";

import { type AgendaTask, type ConfirmBlock, type Step, dayName, fill } from "./engine";
import type { ChatAction, ChatState, Message } from "./thread";

const t = copy.mewChat;
const LISTEN_MS = 2400;
const THUMB_PX = 320;

/** "sexta-feira · 10:00", "hoje". */
export const whenOf = (task: AgendaTask) =>
  [dayName(task.date, zoned()), task.hasTime && format(zoned(task.date), "HH:mm")]
    .filter(Boolean)
    .join(" · ");

/** Shrinks a photo to a thumbnail data URL: a full photo would blow the localStorage quota. */
async function thumbnail(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, THUMB_PX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Props = {
  state: ChatState;
  dispatch: (action: ChatAction) => void;
  busy: boolean;
  listening: boolean;
  /** AI credits left this month; `null` when unlimited or not loaded. */
  credits: number | null;
  onSend: (text: string, image?: string) => void;
  onPhoto: () => void;
  onOpenTask: (id: string) => void;
  onReset: () => void;
};

const INPUT_ID = "mew-input";

/** The header Mew reacts to the latest turn: thinks, waits for a confirmation, cheers, gets lost. */
export function moodOf(last: Message | undefined, busy: boolean, listening: boolean): MewMood {
  if (listening) return "listening";
  if (last?.from !== "mew") return busy ? "thinking" : "idle";
  if (busy && (last.typing || !last.text)) return "thinking";
  const step = last.blocks.filter((b): b is ConfirmBlock => b.kind === "confirm").at(-1)?.step;
  if (step === "status") return "thinking";
  if (step === "draft") return "alert";
  if (step === "done") return "happy";
  // ponytail: the simulated engine has no intent; the real /mew/chat should send one.
  if (last.text === t.reply.fallback || last.text === t.reply.notFound) return "confused";
  return "idle";
}

const creditsLabel = (n: number) =>
  n === 0 ? t.creditsNone : n === 1 ? t.creditsOne : fill(t.creditsMany, { n });

/**
 * The Mew's chat: a near-full-height bottom sheet on the `z-chat` layer, under the floating dock,
 * which turns into its message box (`ChatInput`). Non-modal, so the dock outside stays focusable;
 * the scrim is the page's.
 */
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
  state,
  dispatch,
  busy,
  listening,
  credits,
  onSend,
  onPhoto,
  onOpenTask,
  onReset,
}: Props) {
  const log = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const { messages } = state;
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

  const mood = moodOf(messages.at(-1), busy, listening);

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
            <DropdownMenuItem onSelect={() => dispatch({ type: "clear" })}>
              {t.clear}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onReset}>{t.reset}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col items-center">
          <Mew mood={mood} className="w-14" />
          <SheetTitle className="sr-only">{t.title}</SheetTitle>
          <p aria-live="polite" className="sr-only">
            {listening ? t.listeningNow : busy ? t.thinking : ""}
          </p>
          {credits !== null && (
            <p className="mt-1 text-footnote text-ink-secondary tabular-nums">
              {creditsLabel(credits)}
            </p>
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
          {messages.length === 0 ? (
            <Empty onPick={(value) => onSend(value)} onPhoto={onPhoto} />
          ) : (
            messages.map((m) => {
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
            })
          )}
        </div>
      </div>
    </>
  );
}

/**
 * The dock's pill while the chat is open (`CreateDock chat={…}`): attach, field and one round
 * button that is the mic when empty, send with text, stop while listening (the landing's `.cin`).
 */
export function ChatInput({
  busy,
  listening,
  onListening,
  onSend,
  file,
}: {
  busy: boolean;
  listening: boolean;
  onListening: (on: boolean) => void;
  onSend: (text: string, image?: string) => void;
  file: RefObject<HTMLInputElement>;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string>();
  const filled = !!text.trim() || !!image;
  const sends = filled && !listening;

  // Simulated voice: after a beat the fixed transcript lands in the field.
  const heard = useEffectEvent(() => {
    onListening(false);
    setText(t.transcript);
  });
  useEffect(() => {
    if (!listening) return;
    const id = window.setTimeout(heard, LISTEN_MS);
    return () => clearTimeout(id);
  }, [listening]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !filled) return;
    onSend(text.trim(), image);
    setText("");
    setImage(undefined);
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
          <img src={image} alt={t.photo} className="h-16 rounded-md object-cover shadow-raised" />
          <button
            type="button"
            aria-label={t.removeImage}
            onClick={() => setImage(undefined)}
            className="absolute -top-2 -right-2 grid size-6 cursor-pointer place-items-center rounded-full bg-ink text-canvas"
          >
            <XIcon aria-hidden="true" className="size-3.5" />
          </button>
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
          if (picked) void thumbnail(picked).then(setImage, () => undefined);
        }}
      />
      <button
        type="button"
        aria-label={t.attach}
        onClick={() => file.current?.click()}
        className="grid size-11 flex-none cursor-pointer place-items-center rounded-full text-ink-secondary transition-colors duration-fast hover:bg-fill hover:text-ink"
      >
        <ImagePlusIcon aria-hidden="true" className="size-5" />
      </button>
      {listening ? (
        <Listening />
      ) : (
        // text-body: below 16px iOS zooms the page on focus.
        <input
          id={INPUT_ID}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          enterKeyHint="send"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-secondary"
        />
      )}
      <button
        type={sends ? "submit" : "button"}
        aria-label={listening ? t.micStop : filled ? t.send : t.mic}
        aria-pressed={listening}
        disabled={busy && sends}
        onClick={sends ? undefined : () => onListening(!listening)}
        className={cn(
          "relative grid size-11 flex-none cursor-pointer place-items-center rounded-full bg-ink text-canvas transition-[background-color,color,scale] duration-fast active:scale-95 disabled:cursor-default disabled:bg-fill-pressed disabled:text-ink-tertiary",
          (filled || listening) && "bg-brand text-on-brand",
          listening && "scale-110",
        )}
      >
        {listening && (
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-full border-2 border-brand motion-reduce:hidden"
          />
        )}
        <MicIcon
          aria-hidden="true"
          className={cn(
            "absolute size-5 transition-[opacity,scale] duration-fast",
            sends && "scale-60 opacity-0",
          )}
        />
        <ArrowUpIcon
          aria-hidden="true"
          className={cn(
            "absolute size-5 transition-[opacity,scale] duration-fast",
            !sends && "scale-60 opacity-0",
          )}
        />
      </button>
    </form>
  );
}

function Listening() {
  return (
    <span role="img" aria-label={t.listeningNow} className="flex h-full flex-1 items-center gap-2">
      <span className="size-2 flex-none animate-pulse rounded-full bg-brand motion-reduce:animate-none" />
      <span className="flex h-5 items-center gap-0.5">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className="h-full w-0.5 animate-bar rounded-full bg-ink-secondary motion-reduce:scale-y-50 motion-reduce:animate-none"
            style={{ animationDelay: `${(i % 6) * 90}ms` }}
          />
        ))}
      </span>
    </span>
  );
}

function Empty({ onPick, onPhoto }: { onPick: (text: string) => void; onPhoto: () => void }) {
  const s = t.suggestions;
  return (
    <div className="my-auto flex flex-col items-center px-4 text-center">
      <MewStatic mood="happy" className="w-20" />
      <p className="mt-4 text-title-3 font-semibold">{t.emptyTitle}</p>
      <p className="mt-1 text-subhead text-ink-secondary">{t.emptyHint}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {[s.today, s.overdue, s.steps].map((value, i) => (
          <motion.span
            key={value}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.soft, delay: 0.1 + i * 0.05 }}
          >
            <Chip onClick={() => onPick(value)}>{value}</Chip>
          </motion.span>
        ))}
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.soft, delay: 0.25 }}
        >
          <Chip icon={<ImagePlusIcon aria-hidden="true" />} onClick={onPhoto}>
            {s.photo}
          </Chip>
        </motion.span>
      </div>
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

function Dots({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex h-5 items-center gap-0.75">
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          className="size-1.5 animate-dot rounded-full bg-ink-tertiary motion-reduce:animate-none"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

/** Steps that close a confirmation: the whole message morphs to them (MessageBox). */
const FINAL: Step[] = ["done", "cancelled", "undone"];

/**
 * One Mew message = one container (`.mwrap/.mbox`, ears on top): the text, then each block opens
 * under it (`.cslot`), its buttons at the container's foot. Typing → text and a confirmation
 * closing morph the whole box; status → draft reopens the block's slot.
 */
/** `--i` drives the `word-in` stagger (global.css). */
const wordAt = (i: number): CSSProperties & Record<string, number> => ({ "--i": i });

function Reply({
  message,
  fresh,
  dispatch,
  onOpenTask,
}: {
  message: Extract<Message, { from: "mew" }>;
  fresh: boolean;
  dispatch: (action: ChatAction) => void;
  onOpenTask: (id: string) => void;
}) {
  const confirm = message.blocks.find((b): b is ConfirmBlock => b.kind === "confirm");
  const key = message.typing
    ? "typing"
    : confirm && FINAL.includes(confirm.step)
      ? confirm.step
      : "text";
  return (
    <div className="flex items-end gap-2">
      <MewStatic happy={confirm?.step === "done"} className="mb-0.5 w-6.5 flex-none" />
      <MessageBox type="text" contentKey={key} className="max-w-bubble">
        {message.typing ? (
          <Dots label={t.thinking} />
        ) : (
          <>
            {/* Every word is in the DOM at once, so the box morphs to its final size. */}
            <p className="min-h-2lh text-subhead">
              {message.text.split(" ").map((word, i) => (
                <Fragment key={i}>
                  {i > 0 && " "}
                  <span className={cn("inline-block", fresh && "word-in")} style={wordAt(i)}>
                    {word}
                  </span>
                </Fragment>
              ))}
            </p>
            {message.blocks.map((block, i) =>
              block.kind === "tasks" ? (
                <Slot key={i} enter={fresh}>
                  <ul className="flex flex-col divide-y divide-separator rounded-md bg-fill px-3">
                    {block.tasks.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => onOpenTask(task.id)}
                          className="flex w-full cursor-pointer flex-col gap-0.5 py-2 text-left"
                        >
                          <span
                            className={cn(
                              "truncate text-subhead font-semibold",
                              task.done && "text-ink-tertiary line-through",
                            )}
                          >
                            {task.title}
                          </span>
                          <Meta>
                            {task.hasTime ? format(zoned(task.date), "HH:mm") : t.allDay}
                            {task.calendar && <Calendar />}
                          </Meta>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Slot>
              ) : (
                <Slot
                  key={`${i}-${block.step === "status" ? "status" : "body"}`}
                  enter={fresh && !FINAL.includes(block.step)}
                >
                  <ConfirmBody block={block} dispatch={dispatch} />
                </Slot>
              ),
            )}
          </>
        )}
      </MessageBox>
    </div>
  );
}

/** `.cslot` inside a message: the block opens its own height after the text. */
function Slot({ enter, children }: { enter: boolean; children: ReactNode }) {
  return (
    <Reveal enter={enter} className="pt-2.5">
      {children}
    </Reveal>
  );
}

/**
 * Opens its own height on mount (grid rows 0fr → 1fr) while the content fades up: CSS from
 * `@starting-style`, no height in JS, no blur. `enter={false}` just shows it.
 */
function Reveal({
  enter,
  className,
  children,
}: {
  enter: boolean;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid flex-none grid-rows-[1fr]",
        enter &&
          "transition-[grid-template-rows] duration-460 ease-out-quint starting:grid-rows-[0fr] motion-reduce:transition-none",
      )}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden",
          enter &&
            "transition-[opacity,translate] delay-80 duration-slow ease-out starting:translate-y-2.5 starting:opacity-0 motion-reduce:transition-none",
        )}
      >
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}

function Calendar() {
  return (
    <>
      <CalendarBadge />
      <span>{copy.calendar.name}</span>
    </>
  );
}

/** `.pbtn`: the 34px pill buttons at the foot of a message. */
const PILL = "h-8.5 rounded-full px-3.5 text-sm font-semibold";

function ConfirmBody({
  block,
  dispatch,
}: {
  block: ConfirmBlock;
  dispatch: (action: ChatAction) => void;
}) {
  const b = t.box;
  const { action, step } = block;
  const picked = block.after.filter((x) => !block.off.includes(x.id));
  const n = action === "delete" || action === "move" ? block.before.length : picked.length;
  const values = { n, day: block.label ?? "", task: block.label ?? "" };

  if (step === "status")
    return (
      <div className="flex items-center gap-2 text-subhead whitespace-nowrap text-ink-secondary">
        {action === "event" ? (
          <CalendarBadge />
        ) : (
          <SearchIcon aria-hidden="true" className="size-4 text-ink" />
        )}
        {action === "event" ? b.connecting : b.searching}
        <Dots label={action === "event" ? b.connecting : b.searching} />
      </div>
    );

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
            className={PILL}
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
      <ul className="flex flex-col divide-y divide-separator rounded-md bg-fill px-3">
        {action === "move" &&
          block.after.map((task, i) => (
            <Row key={task.id} title={task.title}>
              <s className="text-ink-tertiary">{whenOf(block.before[i])}</s>
              <ArrowRightIcon aria-hidden="true" />
              <span className="text-ink">{whenOf(task)}</span>
            </Row>
          ))}
        {action === "delete" &&
          block.before.map((task) => (
            <Row key={task.id} title={task.title}>
              {whenOf(task)}
            </Row>
          ))}
        {action === "event" &&
          block.after.map((task) => (
            <Row key={task.id} title={task.title}>
              <CalendarBadge />
              {whenOf(task)}
            </Row>
          ))}
        {(action === "create" || action === "steps") &&
          block.after.map((task) => {
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
                      className="min-w-0 bg-transparent text-base font-semibold outline-none"
                    />
                  ) : (
                    <span className="text-subhead font-medium">{task.title}</span>
                  )}
                  {action === "create" && (
                    <span className="text-footnote text-ink-secondary tabular-nums">
                      {whenOf(task)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
      </ul>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => dispatch({ type: "cancel", block: block.id })}
          className={PILL}
        >
          {b.cancel}
        </Button>
        <Button
          size="sm"
          disabled={!n}
          onClick={() => dispatch({ type: "confirm", block: block.id })}
          className={PILL}
        >
          {fill(cta, values)}
        </Button>
      </div>
    </>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-0.5 py-2">
      <span className="truncate text-subhead font-semibold">{title}</span>
      <Meta>{children}</Meta>
    </li>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-footnote text-ink-secondary tabular-nums [&_svg]:size-3.5 [&_svg]:flex-none">
      {children}
    </span>
  );
}
