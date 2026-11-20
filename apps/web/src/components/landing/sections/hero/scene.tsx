import { useInView, useReducedMotion } from "motion/react";
import {
  ArrowUp,
  Bell,
  Calendar,
  Check,
  Clock,
  type LucideIcon,
  Mic,
  Pencil,
  Repeat,
  Text,
  User,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Bubble } from "@/components/mew/bubble";
import { Tail } from "@/components/mew/tail";
import { Mew } from "@/components/mew/mew";
import { damp } from "@/components/mew/spring";
import { duration, ease } from "@/consts/motion";
import { cn } from "@/lib/utils";

import { type RowKind, copy } from "./copy";
import { replyWords, rowsFor, timeline } from "./script";

type Phase = "off" | "idle" | "typing" | "ready" | "sent";
type View = {
  run: number;
  i: number;
  phase: Phase;
  shown: number;
  press: boolean;
  calOn: boolean;
  calDay: string;
  reply: "none" | "on" | "out";
};

const SCENES = copy.scenes;
const START: View = {
  run: 0,
  i: 0,
  phase: "off",
  shown: 0,
  press: false,
  calOn: false,
  calDay: copy.calendar.day,
  reply: "none",
};
// reduced motion: cena 1 já anotada
const FINAL: View = { ...START, phase: "ready", shown: timeline(SCENES[0].say).words.length };

const ICONS: Record<RowKind, { Icon: LucideIcon; tone: string }> = {
  title: { Icon: Text, tone: "text-ink" },
  date: { Icon: Calendar, tone: "text-meta-date" },
  time: { Icon: Clock, tone: "text-meta-time" },
  repeat: { Icon: Repeat, tone: "text-meta-repeat" },
  user: { Icon: User, tone: "text-ink-secondary" },
  bell: { Icon: Bell, tone: "text-ink-secondary" },
};

const STANDARD = `cubic-bezier(${ease.standard.join()})`;

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// loops decorativos sem keyframes no CSS: ref callback estável (módulo) dispara um WAAPI infinito
const loop =
  (kf: Keyframe[], o: KeyframeAnimationOptions) =>
  (el: Element | null): void => {
    if (el && typeof el.animate === "function" && !reduced())
      el.animate(kf, { iterations: Infinity, ...o });
  };
const DOTS = [0, 150, 300].map((delay) =>
  loop(
    [
      { opacity: 0.35, translate: "0 0" },
      { opacity: 1, translate: "0 -3px", offset: 0.3 },
      { opacity: 0.35, translate: "0 0", offset: 0.6 },
      { opacity: 0.35, translate: "0 0" },
    ],
    { duration: 1200, delay, easing: STANDARD },
  ),
);
const SCRIBBLE = loop(
  [
    { rotate: "0deg", translate: "0 0" },
    { rotate: "-12deg", translate: "-1px 1px", offset: 0.25 },
    { rotate: "8deg", translate: "1px 0", offset: 0.75 },
    { rotate: "0deg", translate: "0 0" },
  ],
  { duration: 900, easing: STANDARD },
);
const SHINE = loop([{ backgroundPosition: "0 0" }, { backgroundPosition: "-200% 0" }], {
  duration: 1600,
});

// a mola do DS (`--motion-ease-spring`) pro WAAPI, que não lê `var()`
const spring = () =>
  getComputedStyle(document.documentElement).getPropertyValue("--motion-ease-spring").trim() ||
  `cubic-bezier(${ease.out.join()})`;

// a casca do balão voa em arco até o ícone da agenda: X sai rápido, Y cai no fim, vira o ícone
function fly(wrap: HTMLElement, target: HTMLElement) {
  const a = wrap.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const sx = b.width / a.width;
  const sy = b.height / a.height;
  const o: KeyframeAnimationOptions = { duration: 720, fill: "forwards" };
  wrap.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], {
    ...o,
    easing: "cubic-bezier(0.3,0,0.2,1)",
  });
  wrap.animate([{ transform: "translateY(0)" }, { transform: `translateY(${dy}px)` }], {
    ...o,
    easing: "cubic-bezier(0.6,0,0.9,0.4)",
    composite: "add",
  });
  wrap.animate([{ transform: "scale(1)" }, { transform: `scale(${sx},${sy})` }], {
    ...o,
    easing: "cubic-bezier(0.55,0,0.25,1)",
    composite: "add",
  });
  wrap.animate([{ opacity: 1 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], o);
  // Radius corrected for the scale, so it lands as the icon's own radius instead of squashed.
  const shell = wrap.firstElementChild;
  if (!shell) return;
  const from = getComputedStyle(shell).borderTopLeftRadius;
  const to = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
  shell.animate([{ borderRadius: from }, { borderRadius: `${to / sx}px / ${to / sy}px` }], {
    ...o,
    easing: "cubic-bezier(0.55,0,0.25,1)",
  });
}

export function HeroScene() {
  const reduce = useReducedMotion() ?? false;
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { margin: "64px" });
  const look = useRef<Element | null>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const lastWord = useRef<HTMLSpanElement>(null);
  const said = useRef<HTMLParagraphElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const think = useRef<HTMLDivElement>(null);
  const cal = useRef<HTMLDivElement>(null);
  const tails = useRef<(SVGSVGElement | null)[]>([]);
  const at = useRef(0);
  const [state, setView] = useState<View>(START);
  const v = reduce ? FINAL : state;
  // enviado: o texto some mas segue no DOM; o campo volta a 1 linha (h-11) em vez de ficar vazio alto
  const sent = useRef(false);
  useEffect(() => {
    sent.current = v.phase === "sent";
  });

  // a setinha dos dois balões segue a cabeça da Mew, sem re-render
  const onHeadMove = useCallback((px: number) => {
    for (const t of tails.current) {
      const lim = (t?.parentElement?.offsetWidth ?? 0) / 2 - 36;
      if (t) t.style.translate = `${Math.max(-lim, Math.min(lim, px)).toFixed(1)}px 0`;
    }
  }, []);

  // por frame: caret deslizando até o fim da última palavra, campo crescendo com o texto
  useEffect(() => {
    if (reduce || !inView) return;
    let raf = 0;
    let last = performance.now();
    let cx = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const w = lastWord.current;
      let gy = 12;
      if (w) {
        const gx = w.offsetLeft + w.offsetWidth + 1;
        gy = w.offsetTop + (w.offsetHeight - 20) / 2;
        if (Math.abs(gx - cx) > 200) cx = gx - 24;
        cx = damp(cx, gx, 0.05, dt);
      } else cx = 0;
      if (caret.current) caret.current.style.transform = `translate(${cx.toFixed(1)}px,${gy}px)`;
      if (field.current && said.current)
        field.current.style.height = `${sent.current ? 44 : said.current.offsetHeight}px`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, inView]);

  // o roteiro: no cleanup os timers somem e a async fica pendurada (sem setState fora da tela)
  useEffect(() => {
    if (reduce || !inView) return;
    const timers = new Set<number>();
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const t = window.setTimeout(() => {
          timers.delete(t);
          res();
        }, ms);
        timers.add(t);
      });
    const clearFlight = () => {
      const wrap = think.current?.firstElementChild;
      [wrap, wrap?.firstElementChild].forEach((el) =>
        el?.getAnimations().forEach((a) => a.cancel()),
      );
    };
    let run = 0;

    (async () => {
      for (;;) {
        const i = at.current;
        const sc = SCENES[i];
        const t = timeline(sc.say);
        clearFlight();
        look.current = null;
        setView((s) => ({ ...START, calDay: s.calDay, run: ++run, i }));
        await wait(40);
        setView((s) => ({ ...s, phase: "idle" }));
        await wait(1100);

        setView((s) => ({ ...s, phase: "typing" }));
        look.current = caret.current;
        for (let k = 0; k < t.words.length; k++) {
          await wait(k ? t.at[k] - t.at[k - 1] : 0);
          setView((s) => ({ ...s, shown: k + 1 }));
        }
        await wait(520);
        setView((s) => ({ ...s, phase: "ready" }));
        await wait(650);
        setView((s) => ({ ...s, press: true }));
        await wait(130);

        setView((s) => ({ ...s, press: false, phase: "sent", calOn: true }));
        cal.current?.animate([{ scale: 0.6 }, { scale: 1 }], { duration: 600, easing: spring() });
        look.current = cal.current;
        await wait(120);
        const wrap = think.current?.firstElementChild;
        if (wrap instanceof HTMLElement && cal.current) fly(wrap, cal.current);
        await wait(600);
        // pouso: a agenda dá um "bump" e já mostra o dia novo
        setView((s) => ({ ...s, calDay: sc.cal }));
        cal.current
          ?.animate([{ scale: 1 }, { scale: 0.8 }], {
            duration: 90,
            easing: `cubic-bezier(${ease.exit.join()})`,
          })
          .finished.then(() =>
            cal.current?.animate([{ scale: 0.8 }, { scale: 1 }], {
              duration: 700,
              easing: spring(),
            }),
          )
          .catch(() => {});
        await wait(60);
        setView((s) => ({ ...s, reply: "on" }));
        await wait(3600);

        look.current = null;
        setView((s) => ({ ...s, reply: "out", calOn: false }));
        await wait(450);
        at.current = (i + 1) % SCENES.length;
      }
    })();

    return () => {
      timers.forEach(clearTimeout);
      clearFlight();
      look.current = null;
    };
  }, [reduce, inView]);

  const sc = SCENES[v.i];
  const words = timeline(sc.say).words;
  const rows = rowsFor(sc, v.shown);
  const writing = v.phase === "typing" || v.phase === "ready";
  const bubbleOn = v.phase === "sent" || (writing && v.shown > 0);
  const ready = writing && v.shown > 0;

  return (
    <div
      ref={root}
      aria-hidden="true"
      className="flex w-full max-w-105 flex-col items-center gap-3 self-center"
    >
      <div ref={think} className="relative h-51 w-full flex-none md:h-52.5">
        <div
          className={cn(
            "absolute bottom-5.5 left-1/2 max-w-75 -translate-x-1/2 origin-bottom transition-[opacity,scale,width] duration-300 ease-out",
            v.phase === "idle" ? "w-30.5" : "w-full",
            v.phase === "idle" || bubbleOn ? "scale-100 opacity-100" : "scale-92 opacity-0",
          )}
        >
          <Bubble
            className={cn(
              "mt-0 flex flex-col gap-2.5",
              v.phase === "sent" && "*:opacity-0 *:transition-opacity *:duration-150",
            )}
          >
            <Tail ref={(el) => void (tails.current[0] = el)} />
            {v.phase === "idle" ? (
              <div className="flex h-5.5 items-center gap-1.25 text-sm font-semibold whitespace-nowrap text-ink-secondary">
                <span className="mr-0.75">{copy.thinking}</span>
                {DOTS.map((ref, k) => (
                  <i
                    key={k}
                    ref={ref}
                    className="size-1.25 flex-none rounded-full bg-ink-tertiary"
                  />
                ))}
              </div>
            ) : (
              <div className="relative h-5.5 text-sm leading-5.5 font-semibold">
                <span
                  className={cn(
                    "absolute inset-0 flex items-center gap-1.75 text-ink-secondary transition-[opacity,translate,filter] duration-300 ease-out",
                    v.phase !== "typing" && "-translate-y-1.5 opacity-0 blur-xs",
                  )}
                >
                  <Pencil ref={SCRIBBLE} className="size-4 flex-none" />
                  <b
                    ref={SHINE}
                    className="bg-linear-to-r from-ink-secondary via-ink to-ink-secondary bg-size-[200%_100%] bg-clip-text font-semibold text-transparent"
                  >
                    {copy.noting}
                  </b>
                </span>
                <span
                  className={cn(
                    "absolute inset-0 flex items-center gap-1.75 text-brand-text transition-[opacity,translate,filter] duration-300 ease-out",
                    v.phase === "typing" && "translate-y-1.5 opacity-0 blur-xs",
                  )}
                >
                  <Check className="size-4 flex-none" strokeWidth={2.6} />
                  <b className="font-semibold">{copy.understood}</b>
                </span>
              </div>
            )}
            <div className="flex flex-col gap-2 overflow-hidden">
              {rows.map((r) => {
                const { Icon, tone } = ICONS[r.kind];
                return (
                  <div
                    key={`${v.run}-${r.kind}-${r.at}`}
                    className="grid grid-rows-[1fr] transition-[grid-template-rows,margin] duration-240 ease-out starting:-mt-2 starting:grid-rows-[0fr]"
                  >
                    <div className="min-h-0">
                      <div
                        className={cn(
                          "flex items-center gap-2.5 text-sm leading-5 font-medium transition-[opacity,filter,translate] delay-60 duration-400 ease-out starting:translate-y-1.25 starting:opacity-0 starting:blur-xs",
                          r.kind === "title" && "text-lg leading-5.5 font-semibold",
                        )}
                      >
                        <Icon className={cn("size-4 flex-none", tone)} />
                        <span>{r.text}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Bubble>
        </div>

        <div
          className={cn(
            "absolute bottom-5.5 left-1/2 w-full max-w-72.5 -translate-x-1/2 origin-bottom",
            v.reply === "on"
              ? "scale-100 opacity-100 transition-[opacity,scale] duration-600 ease-spring"
              : "scale-92 opacity-0 transition-opacity duration-260 ease-out",
          )}
        >
          <Bubble className="mt-0 pb-3.75">
            <Tail ref={(el) => void (tails.current[1] = el)} />
            <p className="text-base leading-5.5">
              {v.reply !== "none" &&
                replyWords(SCENES[v.i].reply).map((w, k) => (
                  <span key={`${v.run}-${k}`}>
                    {k > 0 && " "}
                    <span
                      className={cn(
                        "inline-block transition-[opacity,filter,translate] duration-420 ease-out starting:translate-y-1 starting:opacity-0 starting:blur-xs",
                        w.strong && "font-semibold text-brand-text",
                      )}
                      style={{ transitionDelay: `${k * (duration.stagger * 1000) + 120}ms` }}
                    >
                      {w.text}
                    </span>
                  </span>
                ))}
            </p>
          </Bubble>
        </div>
      </div>

      <div className="relative w-33 flex-none md:w-39">
        <Mew lookAt={look} onHeadMove={onHeadMove} happy={v.reply === "on"} className="w-full" />
        <div
          ref={cal}
          className={cn(
            "absolute -top-2.5 -right-24 flex size-14 flex-col items-center overflow-hidden rounded-md bg-surface-raised shadow-raised transition-opacity duration-240 ease-out",
            v.calOn ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="w-full bg-brand text-center text-2xs leading-4 font-bold tracking-wider text-on-brand">
            {copy.calendar.month}
          </span>
          <span className="text-2xl leading-9 font-semibold tabular-nums">{v.calDay}</span>
        </div>
      </div>

      {/* altura do composer com 3 linhas reservada: ele cresce para baixo sem empurrar a página */}
      <div className="h-26 w-full flex-none">
        <div
          className={cn(
            "flex w-full items-end gap-1 rounded-lg bg-fill p-1.5 transition-shadow duration-200",
            writing && !reduce && "ring-2 ring-brand",
          )}
        >
          <span className="grid size-11 flex-none place-items-center rounded-full text-ink-secondary">
            <Mic className="size-4.5" />
          </span>
          <div
            ref={field}
            className={cn(
              "relative min-w-0 flex-1 overflow-hidden transition-[height] duration-220 ease-out",
              reduce ? "h-auto" : "h-11",
            )}
          >
            <span
              ref={caret}
              hidden={!writing || reduce}
              className="absolute top-0 left-0 h-5 w-0.5 animate-caret-blink rounded-full bg-brand will-change-transform"
            />
            <p
              ref={said}
              className={cn(
                "py-2.5 text-lg leading-6 text-ink transition-[opacity,translate] duration-180 ease-out",
                v.phase === "sent" && "-translate-y-1 opacity-0",
              )}
            >
              {v.phase === "off" || v.phase === "idle" ? (
                <span className="text-ink-tertiary">{copy.placeholder}</span>
              ) : (
                words.slice(0, v.shown).map((w, k) => (
                  <span key={`${v.run}-${k}`}>
                    {k > 0 && " "}
                    <span
                      ref={k === v.shown - 1 ? lastWord : undefined}
                      className="inline-block transition-[opacity,filter,translate] duration-500 ease-out starting:translate-y-1 starting:opacity-0 starting:blur-xs"
                    >
                      {w}
                    </span>
                  </span>
                ))
              )}
            </p>
          </div>
          <span
            className={cn(
              "grid size-11 flex-none place-items-center rounded-full transition-[background-color,color,scale] duration-160",
              ready ? "bg-brand text-on-brand" : "bg-fill-pressed text-ink-tertiary",
              v.press && "scale-88",
            )}
          >
            <ArrowUp className="size-4.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
