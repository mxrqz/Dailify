import {
  type FormEvent,
  type ReactNode,
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
import { motion, useReducedMotion } from "motion/react";

import { copy } from "@/components/dashboard/copy";
import { CheckCircle, TaskRow } from "@/components/dashboard/day-task-row";
import { Chip } from "@/components/kit/chip";
import { BubbleDefs } from "@/components/landing/kit/bubble";
import { MessageBox, type MessageType } from "@/components/landing/kit/message-box";
import { CalendarBadge } from "@/components/logos";
import { MewStatic } from "@/components/mew/mew-static";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { duration, spring } from "@/consts/motion";
import { zoned } from "@/functions/zone";
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
  onSend: (text: string, image?: string) => void;
  onOpenTask: (id: string) => void;
  onReset: () => void;
};

/** The Mew's chat: a near-full-height bottom sheet. `listen` opens it already listening (the dock mic). */
export function ChatDrawer({
  open,
  onOpenChange,
  listen,
  ...props
}: Props & { open: boolean; onOpenChange: (open: boolean) => void; listen: boolean }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="h-11/12 px-0 sm:mx-auto sm:w-sheet"
      >
        <BubbleDefs />
        <ChatPanel listen={listen} {...props} />
      </SheetContent>
    </Sheet>
  );
}

function ChatPanel({
  state,
  dispatch,
  busy,
  onSend,
  onOpenTask,
  onReset,
  listen,
}: Props & { listen: boolean }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string>();
  const [listening, setListening] = useState(listen);
  const file = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const { messages } = state;

  // Simulated voice: after a beat the fixed transcript lands in the field.
  useEffect(() => {
    if (!listening) return;
    const id = window.setTimeout(() => {
      setListening(false);
      setText(t.transcript);
    }, LISTEN_MS);
    return () => clearTimeout(id);
  }, [listening]);

  // Follow the reply only when already near the bottom, or when I just sent.
  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (first.current || near || messages.at(-2)?.from === "me") el.scrollTop = el.scrollHeight;
    first.current = false;
  }, [messages]);

  const send = (value: string, img = image) => {
    if (busy || (!value.trim() && !img)) return;
    onSend(value.trim(), img);
    setText("");
    setImage(undefined);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(text);
  };

  const last = messages.at(-1);
  const happy =
    last?.from === "mew" && last.blocks.some((b) => b.kind === "confirm" && b.step === "done");
  const mood = listening ? "listening" : busy ? "thinking" : "idle";

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
          <MewStatic mood={mood} happy={happy && !busy} className="w-10" />
          <SheetTitle className="mt-1 text-body">{t.title}</SheetTitle>
          <p aria-live="polite" className="text-footnote text-ink-secondary">
            {listening ? t.listeningNow : busy ? t.thinking : t.online}
          </p>
        </div>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" aria-label={t.close} className="justify-self-end">
            <XIcon aria-hidden="true" />
          </Button>
        </SheetClose>
      </header>

      <div
        ref={log}
        role="log"
        aria-label={t.thread}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-4"
      >
        {messages.length === 0 ? (
          <Empty onPick={(value) => send(value)} onPhoto={() => file.current?.click()} />
        ) : (
          messages.map((m) =>
            m.from === "me" ? (
              <Mine key={m.id} message={m} />
            ) : (
              <Reply key={m.id} message={m} dispatch={dispatch} onOpenTask={onOpenTask} />
            ),
          )
        )}
      </div>

      <form onSubmit={submit} className="px-3 pt-2 pb-safe">
        {image && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring.soft}
            className="relative mb-2 ml-1 w-fit"
          >
            <img src={image} alt={t.photo} className="h-16 rounded-md object-cover" />
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
        <div className="flex items-center gap-1 rounded-panel bg-fill p-1">
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.attach}
            onClick={() => file.current?.click()}
            className="rounded-full"
          >
            <ImagePlusIcon aria-hidden="true" />
          </Button>
          {listening ? (
            <Listening />
          ) : (
            // text-base: below 16px iOS zooms the page on focus.
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t.placeholder}
              aria-label={t.placeholder}
              enterKeyHint="send"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 bg-transparent px-1 text-base text-ink outline-none placeholder:text-ink-tertiary"
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={listening ? t.micStop : t.mic}
            aria-pressed={listening}
            onClick={() => setListening((on) => !on)}
            className={cn("rounded-full", listening && "bg-brand-soft text-brand-text")}
          >
            <MicIcon aria-hidden="true" />
          </Button>
          <Button
            type="submit"
            size="icon"
            aria-label={t.send}
            disabled={busy || (!text.trim() && !image)}
            className="rounded-full"
          >
            <ArrowUpIcon aria-hidden="true" />
          </Button>
        </div>
      </form>
    </>
  );
}

function Listening() {
  const reduce = useReducedMotion();
  return (
    <span
      role="img"
      aria-label={t.listeningNow}
      className="flex h-11 flex-1 items-center gap-1 px-1"
    >
      {Array.from({ length: 18 }, (_, i) => (
        <motion.span
          key={i}
          className="h-6 w-1 rounded-full bg-brand-text"
          initial={{ scaleY: 0.2 }}
          animate={reduce ? { scaleY: 0.5 } : { scaleY: [0.2, 1, 0.35, 0.8, 0.2] }}
          transition={{ duration: 1.1, delay: (i % 6) * 0.09, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
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

const enter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: spring.soft,
} as const;

function Mine({ message }: { message: Extract<Message, { from: "me" }> }) {
  return (
    <motion.div {...enter} className="flex flex-col items-end gap-1 pl-12">
      {message.image && (
        <img
          src={message.image}
          alt={t.photo}
          className="max-h-40 rounded-lg rounded-br-xs object-cover"
        />
      )}
      {message.text && (
        <p className="rounded-lg rounded-br-xs bg-brand px-3.5 py-2 text-subhead text-on-brand">
          {message.text}
        </p>
      )}
    </motion.div>
  );
}

function Dots({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex h-5 items-center gap-0.75">
      {[0, 1, 2].map((i) => (
        <motion.i
          key={i}
          className="size-1.5 rounded-full bg-ink-tertiary"
          animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
          transition={{ duration: 1.2, delay: i * 0.15, repeat: Infinity, times: [0, 0.3, 0.6] }}
        />
      ))}
    </span>
  );
}

function Reply({
  message,
  dispatch,
  onOpenTask,
}: {
  message: Extract<Message, { from: "mew" }>;
  dispatch: (action: ChatAction) => void;
  onOpenTask: (id: string) => void;
}) {
  const done = message.blocks.some((b) => b.kind === "confirm" && b.step === "done");
  return (
    <motion.div {...enter} className="flex items-end gap-2 pr-2">
      <MewStatic happy={done} className="mb-0.5 w-6.5 flex-none" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <MessageBox type="text" contentKey={message.typing ? "typing" : "text"}>
          {message.typing ? (
            <Dots label={t.thinking} />
          ) : (
            <p className="text-subhead">
              {message.words.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: duration.slow }}
                >
                  {i > 0 && " "}
                  {word}
                </motion.span>
              ))}
            </p>
          )}
        </MessageBox>
        {message.blocks.map((block, i) =>
          block.kind === "tasks" ? (
            <ul key={i} className="flex w-full flex-col gap-1.5">
              {block.tasks.map((task, j) => (
                <motion.li
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring.soft, delay: j * 0.06 }}
                >
                  <TaskRow
                    time={task.hasTime ? format(zoned(task.date), "HH:mm") : t.allDay}
                    title={task.title}
                    done={task.done}
                    meta={task.calendar && <Calendar />}
                    onOpen={() => onOpenTask(task.id)}
                  />
                </motion.li>
              ))}
            </ul>
          ) : (
            <Confirm key={block.id} block={block} dispatch={dispatch} />
          ),
        )}
      </div>
    </motion.div>
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

const BOX: Record<Step, MessageType> = {
  status: "status",
  draft: "draft",
  done: "done",
  cancelled: "text",
  undone: "text",
};

/** The landing's MessageBox, live: status → draft → done morphs in one container. */
function Confirm({
  block,
  dispatch,
}: {
  block: ConfirmBlock;
  dispatch: (action: ChatAction) => void;
}) {
  return (
    <MessageBox type={BOX[block.step]} contentKey={block.step} ears={false}>
      <ConfirmBody block={block} dispatch={dispatch} />
    </MessageBox>
  );
}

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

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-0.5 py-2">
      <span className="truncate text-subhead font-semibold">{title}</span>
      <span className="flex items-center gap-1.5 text-footnote text-ink-secondary tabular-nums [&_svg]:size-3.5 [&_svg]:flex-none">
        {children}
      </span>
    </li>
  );
}
