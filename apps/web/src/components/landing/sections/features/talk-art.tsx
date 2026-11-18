import { ArrowUp, Bell, CalendarDays, Mic, Play } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";

import { MessageBox } from "@/components/mew/message-box";
import { MewStatic } from "@/components/mew/mew-static";
import { cn } from "@/lib/utils";

import { copy } from "./copy";
import { Slot, Words, useScene } from "./scene";

const t = copy.talk;
type Msg = "voice" | "ask" | "mine" | "evt";
const ALL: Msg[] = ["voice", "ask", "mine", "evt"];
const REPLY = t.reply.split(" ");
// onda do áudio já gravado (parada), em px
const WAVE = [6, 12, 18, 10, 22, 14, 8, 16, 20, 9, 13, 6, 11, 17, 7];

/** Chat com input fixo: grava áudio, a Mewki pergunta o que faltou, você digita, vira evento. */
export function TalkArt() {
  const ref = useRef<HTMLDivElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [mode, setMode] = useState<"idle" | "rec" | "typing">("idle");
  const [sec, setSec] = useState(0);
  const [typed, setTyped] = useState(0);
  const [press, setPress] = useState(false);
  const [out, setOut] = useState(false);
  const push = (m: Msg) => setMsgs((l) => [...l, m]);

  const reduce = useScene(ref, async (wait) => {
    setOut(false);
    setMsgs([]);
    setMode("idle");
    await wait(900);
    setMode("rec");
    for (let s = 0; s <= 4; s++) {
      setSec(s);
      await wait(s < 4 ? 480 : 300);
    }
    setMode("idle");
    push("voice");
    await wait(1300);
    push("ask");
    await wait(1500);
    setTyped(0);
    setMode("typing");
    for (let i = 1; i <= REPLY.length; i++) {
      setTyped(i);
      await wait(260);
    }
    await wait(500);
    setPress(true);
    await wait(140);
    setPress(false);
    setMode("idle");
    push("mine");
    await wait(1200);
    push("evt");
    await wait(3400);
    setOut(true);
    await wait(450);
  });

  return (
    <div ref={ref} className="absolute inset-0 mx-auto flex w-full max-w-90 flex-col p-3.5">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col justify-end overflow-hidden mask-t-from-80% transition-opacity duration-400 ease-out",
          out && "opacity-0",
        )}
      >
        {(reduce ? ALL : msgs).map((m) => (
          <Slot key={m}>
            <Message m={m} />
          </Slot>
        ))}
      </div>

      <div className="mt-3 flex h-11 flex-none items-center gap-2 rounded-full bg-fill pr-1 pl-4 text-sm">
        {mode === "idle" && <span className="truncate text-ink-tertiary">{t.placeholder}</span>}
        {mode === "rec" && (
          <span className="flex flex-1 items-center gap-2 tabular-nums">
            <motion.i
              className="size-2 rounded-full bg-brand"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            {`0:0${sec}`}
            <span className="flex h-5 items-center gap-0.5">
              {Array.from({ length: 14 }, (_, i) => (
                <i
                  key={i}
                  className="h-4.5 w-0.5 origin-center animate-bar rounded-xs bg-ink-secondary motion-reduce:animate-none"
                  style={{ animationDelay: `${(i % 3) * 0.2}s` }}
                />
              ))}
            </span>
          </span>
        )}
        {mode === "typing" && (
          <span className="flex-1 whitespace-nowrap">
            <Words text={REPLY.slice(0, typed).join(" ")} />
          </span>
        )}
        <span
          className={cn(
            "relative ml-auto grid size-9 flex-none place-items-center rounded-full bg-ink text-canvas transition-[background-color,color,scale] duration-300 ease-spring",
            mode !== "idle" && "bg-brand text-on-brand",
            mode === "rec" && "scale-118",
            press && "scale-88",
          )}
        >
          {mode === "rec" && (
            <motion.span
              className="absolute -inset-1.5 rounded-full border-2 border-brand"
              initial={{ opacity: 0.8, scale: 0.85 }}
              animate={{ opacity: 0, scale: 1.35 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <Mic
            className={cn(
              "absolute size-4.25 transition-[opacity,scale] duration-base",
              mode === "typing" && "scale-60 opacity-0",
            )}
          />
          <ArrowUp
            className={cn(
              "absolute size-4.25 transition-[opacity,scale] duration-base",
              mode !== "typing" && "scale-60 opacity-0",
            )}
          />
        </span>
      </div>
    </div>
  );
}

function Message({ m }: { m: Msg }) {
  if (m === "voice")
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex h-9.5 items-center gap-2 rounded-full bg-fill pr-3 pl-1.5">
          <span className="grid size-6.5 place-items-center rounded-full bg-ink text-canvas">
            <Play className="ml-px size-2.75 fill-current" />
          </span>
          <span className="flex h-6 items-center gap-0.5">
            {WAVE.map((h, i) => (
              <i key={i} className="w-0.5 rounded-xs bg-ink-secondary" style={{ height: h }} />
            ))}
          </span>
          <span className="text-xs text-ink-secondary tabular-nums">{t.voiceLength}</span>
        </div>
        <small className="text-xs text-ink-secondary italic">{t.transcript}</small>
      </div>
    );
  if (m === "mine")
    return (
      <div className="flex justify-end">
        <div className="rounded-lg rounded-br-xs bg-brand px-3.5 py-2 text-sm text-on-brand">
          {t.reply}
        </div>
      </div>
    );
  return (
    <div className="flex items-end gap-2">
      <MewStatic className="mb-0.5 w-6.5 flex-none" happy={m === "evt"} />
      {m === "ask" ? (
        <MessageBox type="text" className="max-w-58">
          <p className="text-sm">{t.question}</p>
        </MessageBox>
      ) : (
        <MessageBox type="text" className="min-w-50">
          <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <CalendarDays className="size-3.25" />
            {t.eventKind}
          </span>
          <b className="block text-base font-semibold">{t.eventTitle}</b>
          <span className="block text-xs text-ink-secondary tabular-nums">{t.eventWhen}</span>
          <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-brand-text">
            <Bell className="size-3.25" />
            {t.eventAlert}
          </span>
        </MessageBox>
      )}
    </div>
  );
}
