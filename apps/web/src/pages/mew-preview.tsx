import { useEffect, useReducer, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { CreateDock } from "@/components/dashboard/composer-views";
import { copy } from "@/components/dashboard/copy";
import { CheckCircle, TaskRow } from "@/components/dashboard/day-task-row";
import { PageHeader } from "@/components/kit/page-header";
import { CalendarBadge } from "@/components/logos";
import { ChatDrawer, ChatInput } from "@/components/mew-chat/chat-drawer";
import {
  type AgendaTask,
  dayName,
  isOverdue,
  reply,
  seedAgenda,
} from "@/components/mew-chat/engine";
import {
  type ChatAction,
  chatReducer,
  loadChat,
  mewId,
  saveChat,
} from "@/components/mew-chat/thread";
import { fade, spring } from "@/consts/motion";
import { zoned } from "@/functions/zone";
import { cn } from "@/lib/utils";

const t = copy.mewChat;
// Mirrors the `word-in` stagger in global.css: what follows the text waits for its last word.
const WORD_MS = 38;
const FOCUS_MS = 1800;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Plays the engine's events on a clock; `busy` until the last one lands. */
function usePlayer(dispatch: (action: ChatAction) => void) {
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const send = (text: string, image: string | undefined, tasks: AgendaTask[]) => {
    const id = newId();
    let n = 0;
    const events = reply(text, {
      tasks,
      now: zoned(),
      image: !!image,
      nextId: () => `${id}-${++n}`,
    });
    dispatch({ type: "send", id, text, image });
    setBusy(true);
    let at = 0;
    for (const event of events) {
      if (event.type === "typing" || event.type === "settle") at += event.ms;
      timers.current.push(
        window.setTimeout(() => dispatch({ type: "event", to: mewId(id), event }), at),
      );
      if (event.type === "text" && !reduce) at += event.text.split(" ").length * WORD_MS;
    }
    timers.current.push(window.setTimeout(() => setBusy(false), at));
  };
  return { busy, send };
}

/**
 * Public preview of the Mew chat (`/preview/mew`): a fake mobile dashboard whose composer opens the
 * chat drawer. Everything is simulated and kept in localStorage; nothing reaches the server.
 */
export default function MewPreview() {
  const [state, dispatch] = useReducer(
    chatReducer,
    undefined,
    () => loadChat() ?? { messages: [], tasks: seedAgenda(zoned()) },
  );
  const { busy, send } = usePlayer(dispatch);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const photo = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState<string | null>(null);

  // Once per finished reply (and per tap after it), not per event: the thread carries photo thumbnails.
  useEffect(() => {
    if (!busy) saveChat(state);
  }, [busy, state]);

  useEffect(() => {
    if (!focus) return;
    document
      .getElementById(`task-${focus}`)
      ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    const id = window.setTimeout(() => setFocus(null), FOCUS_MS);
    return () => clearTimeout(id);
  }, [focus]);

  const openChat = (voice: boolean) => {
    setListening(voice);
    setOpen(true);
  };

  return (
    <div className="h-dvh bg-canvas">
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      {/* transform: the dock's `fixed` pins to this phone-width column instead of the viewport. */}
      <div className="relative mx-auto h-full w-full transform-gpu sm:w-sheet sm:border-x sm:border-separator">
        <div className="h-full overflow-y-auto">
          <Agenda
            tasks={state.tasks}
            focus={focus}
            onComplete={(task) => dispatch({ type: "complete", task })}
          />
          {/* The same dock as the dashboard: open, it is the chat's message box, above the drawer. */}
          <CreateDock
            className="sm:mx-auto sm:w-sheet"
            onOpen={() => openChat(false)}
            onVoice={() => openChat(true)}
            chat={
              open && (
                <ChatInput
                  busy={busy}
                  listening={listening}
                  onListening={setListening}
                  onSend={(text, image) => send(text, image, state.tasks)}
                  file={photo}
                />
              )
            }
          />
        </div>
      </div>
      {/* The drawer is non-modal (the dock outside it must stay usable), so the scrim is ours. */}
      <AnimatePresence>
        {open && <motion.div {...fade} aria-hidden="true" className="fixed inset-0 z-chat scrim" />}
      </AnimatePresence>
      <ChatDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setListening(false);
        }}
        listening={listening}
        state={state}
        dispatch={dispatch}
        busy={busy}
        onSend={(text, image) => send(text, image, state.tasks)}
        onPhoto={() => photo.current?.click()}
        onOpenTask={(id) => {
          setOpen(false);
          setFocus(id);
        }}
        onReset={() => dispatch({ type: "reset", tasks: seedAgenda(zoned()) })}
      />
    </div>
  );
}

function Agenda({
  tasks,
  focus,
  onComplete,
}: {
  tasks: AgendaTask[];
  focus: string | null;
  onComplete: (id: string) => void;
}) {
  const now = zoned();
  const sorted = [...tasks].sort((a, b) => a.date - b.date);
  const late = sorted.filter((task) => isOverdue(task, now));
  const upcoming = sorted.filter(
    (task) => !isOverdue(task, now) && task.date >= startOfDay(now).getTime(),
  );
  const days: { key: string; title: string; tasks: AgendaTask[] }[] = [];
  for (const task of upcoming) {
    const lastDay = days.at(-1);
    if (lastDay && isSameDay(zoned(lastDay.tasks[0].date), zoned(task.date)))
      lastDay.tasks.push(task);
    else {
      const name = dayName(task.date, zoned());
      days.push({
        key: format(zoned(task.date), "yyyy-MM-dd"),
        title: name.charAt(0).toUpperCase() + name.slice(1),
        tasks: [task],
      });
    }
  }
  const sections = [
    ...(late.length ? [{ key: "late", title: t.overdue, tasks: late }] : []),
    ...days,
  ];

  return (
    <>
      <PageHeader
        bar={<p className="w-full text-center text-footnote text-ink-secondary">{t.banner}</p>}
        title={t.today}
        subtitle={format(zoned(), "EEEE, d MMM", { locale: ptBR })}
      />
      <div className="flex flex-col gap-6 px-4 pt-5 pb-4">
        {sections.map((section) => (
          <section key={section.key} aria-label={section.title}>
            <h2
              className={cn(
                "mb-2 px-1 text-subhead font-semibold",
                section.key === "late" ? "text-brand-text" : "text-ink-secondary",
              )}
            >
              {section.title}
            </h2>
            <ul className="flex flex-col gap-1.5">
              <AnimatePresence initial={false}>
                {section.tasks.map((task) => (
                  <motion.li
                    key={task.id}
                    id={`task-${task.id}`}
                    layout
                    layoutDependency={tasks}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={spring.soft}
                  >
                    <TaskRow
                      time={task.hasTime ? format(zoned(task.date), "HH:mm") : t.allDay}
                      title={task.title}
                      done={task.done}
                      live={focus === task.id}
                      meta={
                        task.calendar && (
                          <>
                            <CalendarBadge />
                            <span>{copy.calendar.name}</span>
                          </>
                        )
                      }
                      trailing={
                        <CheckCircle
                          checked={task.done}
                          onCheckedChange={() => onComplete(task.id)}
                          label={task.done ? copy.task.uncomplete : copy.task.complete}
                        />
                      }
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
