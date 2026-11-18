import { Check, CircleDot, Hash, Mail } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";

import { MessageBox } from "@/components/mew/message-box";
import { MewStatic } from "@/components/mew/mew-static";
import { ease } from "@/consts/motion";
import { cn } from "@/lib/utils";

import { copy } from "./copy";
import { Slot, Words, useScene } from "./scene";

const t = copy.ok;
type Scenario = (typeof t.scenarios)[number];
type Step = "status" | "draft" | "done";
const ICONS = { chat: Hash, issue: CircleDot, mail: Mail };
const POINTER_EASE = `cubic-bezier(${ease.outQuint.join()})`;

/** Pedido → "conectando" → rascunho → cursor clica no CTA → enviado. Uma mensagem que muda de tipo. */
export function OkArt() {
  const ref = useRef<HTMLDivElement>(null);
  const ptr = useRef<SVGSVGElement>(null);
  const [k, setK] = useState(0);
  const [bot, setBot] = useState<Step | null>(null);
  const [asked, setAsked] = useState(false);
  const [press, setPress] = useState(false);
  // a troca anterior fica em cima e sobe com o chat: a arte nunca fica vazia entre os cenários
  const [prev, setPrev] = useState<number | null>(null);
  const next = useRef(0);

  const reduce = useScene(ref, async (wait) => {
    const i = next.current;
    next.current = (i + 1) % t.scenarios.length;
    const d = t.scenarios[i];
    setK(i);
    setAsked(false);
    setBot(null);
    await wait(500);
    setAsked(true);
    await wait(900);
    setBot("status");
    await wait(1300 + 520);
    setBot("draft");
    await wait(520 + 260 + d.body.split(" ").length * 50 + 1100);

    const scene = ref.current;
    const btn = scene?.querySelector("[data-cta]");
    if (scene && btn && ptr.current) {
      const a = scene.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      const x = b.left - a.left + b.width * 0.55;
      const y = b.top - a.top + b.height * 0.55;
      ptr.current.animate(
        [
          { opacity: 0, transform: `translate(${x + 60}px,${y + 70}px)` },
          { opacity: 1, offset: 0.2 },
          { opacity: 1, transform: `translate(${x}px,${y}px)` },
        ],
        { duration: 850, easing: POINTER_EASE, fill: "forwards" },
      );
    }
    await wait(900);
    setPress(true);
    await wait(150);
    setPress(false);
    ptr.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" });
    setBot("done");
    await wait(520 + 2400);
    setPrev(i);
  });

  const d = t.scenarios[reduce ? 0 : k];
  const step = reduce ? "draft" : bot;

  return (
    <div ref={ref} className="absolute inset-0 px-4.5 pt-4 pb-4.5">
      <div className="mx-auto flex h-full max-w-90 flex-col justify-end overflow-hidden mask-t-from-75%">
        {/* lista plana com a mesma key: ao virar "anterior" a troca não remonta nem reanima */}
        {[
          prev !== null &&
            prev !== k &&
            !reduce && [
              <Slot key={`me${prev}`}>
                <Ask d={t.scenarios[prev]} />
              </Slot>,
              <Slot key={`bot${prev}`}>
                <Reply d={t.scenarios[prev]} step="done" press={false} still k={prev} />
              </Slot>,
            ],
          (asked || reduce) && (
            <Slot key={`me${k}`}>
              <Ask d={d} />
            </Slot>
          ),
          step && (
            <Slot key={`bot${k}`}>
              <Reply d={d} step={step} press={press} still={reduce} k={k} />
            </Slot>
          ),
        ].flat()}
      </div>
      <svg
        ref={ptr}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 z-10 size-5.5 fill-ink stroke-canvas stroke-[1.5] opacity-0 drop-shadow-md"
      >
        <path strokeLinejoin="round" d="M5 3.5 18.5 10l-6 1.6-2.7 5.9Z" />
      </svg>
    </div>
  );
}

function Ask({ d }: { d: Scenario }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-62.5 rounded-lg rounded-br-xs bg-brand px-3.5 py-2 text-sm text-on-brand">
        {d.ask}
      </div>
    </div>
  );
}

function Reply({
  k,
  ...p
}: {
  d: Scenario;
  step: Step;
  press: boolean;
  still: boolean;
  k: number;
}) {
  return (
    <div className="flex items-end gap-2">
      <MewStatic className="mb-0.5 w-6.5 flex-none" happy={p.step === "done"} />
      <MessageBox type={p.step} contentKey={k}>
        <Body {...p} />
      </MessageBox>
    </div>
  );
}

function Body({
  d,
  step,
  press,
  still,
}: {
  d: Scenario;
  step: Step;
  press: boolean;
  still: boolean;
}) {
  const Icon = ICONS[d.icon];
  if (step === "status")
    return (
      <div className="flex items-center gap-2 text-sm whitespace-nowrap text-ink-secondary">
        <Icon className="size-3.75 text-ink" />
        {d.status}
        <span className="ml-0.5 inline-flex gap-0.75">
          {[0, 1, 2].map((i) => (
            <motion.i
              key={i}
              className="size-1.25 rounded-full bg-ink-tertiary"
              animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
              transition={{
                duration: 1.2,
                delay: i * 0.15,
                repeat: Infinity,
                times: [0, 0.3, 0.6],
              }}
            />
          ))}
        </span>
      </div>
    );
  if (step === "done")
    return (
      <>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
          <Check className="size-4" strokeWidth={2.6} />
          {d.done}
        </div>
        <p className="mt-1.5 truncate border-l-2 border-separator pl-2.5 text-xs text-ink-secondary">
          {d.body}
        </p>
      </>
    );
  return (
    <>
      <div className="mb-2.5">
        <b className="block text-sm font-semibold">{d.title}</b>
        <span className="flex items-center gap-1.25 text-xs text-ink-secondary">
          <Icon className="size-3.25" />
          {d.source}
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-md bg-fill px-3 py-2.5">
        <span className="text-xs font-semibold text-ink-secondary">{d.to}</span>
        <p className="text-sm">{still ? d.body : <Words text={d.body} delay={0.26} />}</p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <span className="inline-flex h-8.5 items-center rounded-sm bg-fill px-3.5 text-sm font-semibold">
          {t.change}
        </span>
        <span
          data-cta
          className={cn(
            "inline-flex h-8.5 items-center rounded-sm bg-brand px-3.5 text-sm font-semibold text-on-brand transition-[scale,background-color] duration-fast ease-out",
            press && "scale-92 bg-brand-pressed",
          )}
        >
          {d.cta}
        </span>
      </div>
    </>
  );
}
