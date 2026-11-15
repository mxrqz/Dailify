import { useReducedMotion } from "motion/react";
import { type RefObject, forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { useInView } from "@/components/landing/kit/use-in-view";

import { eyePath } from "./eye-path";
import { EYES, MewArt } from "./mew-static";
import { springStep } from "./spring";

export type MewBehaviors = {
  breathe: boolean;
  look: boolean;
  blink: boolean;
  ears: boolean;
  tilt: boolean;
};

export type MewHandle = {
  hop(): void;
  earFlick(side?: "left" | "right"): void;
  tilt(): void;
  blink(): void;
  setHappy(on: boolean): void;
};

export type MewProps = {
  className?: string;
  behaviors?: Partial<MewBehaviors>;
  /** Pupilas e cabeça seguem este elemento (como no hero). */
  lookAt?: RefObject<Element | null> | null;
  /** `false`: só as pupilas seguem o `lookAt` — pra quando quem move a Mew é o pai. */
  headFollows?: boolean;
  happy?: boolean;
  /** Sem `title` a Mew é decorativa (aria-hidden). */
  title?: string;
  /** Deslocamento horizontal da cabeça em px, a cada frame — pra `<Tail>` seguir sem re-render. */
  onHeadMove?: (px: number) => void;
};

type Live = {
  behaviors: MewBehaviors;
  lookAt: RefObject<Element | null> | null | undefined;
  headFollows: boolean;
  reduce: boolean;
  onHeadMove?: (px: number) => void;
};

const ALL_ON: MewBehaviors = { breathe: true, look: true, blink: true, ears: true, tilt: true };
const BLINK: Keyframe[] = [
  { transform: "scaleY(1)", easing: "cubic-bezier(.55,0,1,.45)" },
  { transform: "scaleY(.08)", offset: 0.3 },
  { transform: "scaleY(.08)", offset: 0.42, easing: "cubic-bezier(0,.55,.45,1)" },
  { transform: "scaleY(1)" },
];
const HOP: Keyframe[] = [
  { transform: "translateY(0) scale(1,1)" },
  { transform: "translateY(0) scale(1.04,.94)", offset: 0.18 },
  { transform: "translateY(-90px) scale(.97,1.04)", offset: 0.45 },
  { transform: "translateY(0) scale(1.03,.96)", offset: 0.78 },
  { transform: "translateY(0) scale(1,1)" },
];
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// Um controlador por gatinha: molas por meia-vida (iguais em 60/120Hz), WAAPI pros gestos curtos.
function createMew(svg: SVGSVGElement, live: { current: Live }) {
  const q = (k: string) => svg.querySelector<SVGGElement>(`[data-mew="${k}"]`);
  const all = (k: string) => Array.from(svg.querySelectorAll<SVGElement>(`[data-mew="${k}"]`));
  const body = q("body");
  const hopEl = q("hop");
  const ears = { l: q("ear-l"), r: q("ear-r") };
  const eyes = all("eye");
  const whites = all("white");
  const pupils = all("pupil");

  const px = { x: 0, v: 0 };
  const py = { x: 0, v: 0 };
  const hx = { x: 0, v: 0 }; // cabeça acompanhando o olhar em volta (unidades do viewBox)
  const head = { x: 0, v: 0 }; // cabeça seguindo o `lookAt` (px de tela)
  const tilt = { x: 0, v: 0 };
  const mood = { x: 0, v: 0 };
  let gx = 0;
  let gy = 0;
  let tiltGoal = 0;
  let happy = 0;
  let drawn = -1;
  let last = 0;
  let raf = 0;
  let nextMicro = 0;
  let look: Element | null = null;
  let ant: { until: number; dir: number } | null = null;
  const timers = new Set<number>();

  function later(fn: () => void, ms: number) {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  }

  function draw() {
    if (Math.abs(mood.x - drawn) < 1e-3) return;
    drawn = mood.x;
    whites.forEach((w, i) => {
      const [cx, cy, rx, ry] = EYES[i];
      w.setAttribute("d", eyePath(cx, cy, rx, ry, mood.x));
      w.setAttribute("stroke-width", (mood.x * 34).toFixed(1));
    });
    const o = String(Math.max(0, 1 - mood.x * 2.2));
    pupils.forEach((p) => p.setAttribute("opacity", o));
  }

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const { behaviors: b, lookAt, headFollows, onHeadMove } = live.current;
    const c = svg.getBoundingClientRect();
    const k = 1600 / (c.width || 1);
    let headGoal = 0;

    const el = lookAt?.current ?? null;
    if (el !== look) {
      if (el && look) blink();
      if (el && headFollows) {
        const r = el.getBoundingClientRect();
        // antecipa: um tiquinho pro lado contrário antes de virar
        ant = { until: now + 90, dir: -Math.sign(r.left + r.width / 2 - (c.left + c.width / 2)) };
      }
      look = el;
    }
    if (look?.isConnected) {
      const r = look.getBoundingClientRect();
      if (r.width + r.height > 0 && c.width > 0) {
        const lx = r.left + r.width / 2 - (c.left + c.width / 2);
        const ly = r.top + r.height / 2 - (c.top + c.height * 0.55);
        // proporcional ao tamanho: 46px fixos levavam a cabeça inteira de uma Mew pequena
        const maxHead = c.width * 0.35;
        if (headFollows) headGoal = Math.max(-maxHead, Math.min(maxHead, lx * 0.3));
        const d = Math.hypot(lx, ly) || 1;
        const m = Math.min(1, d / 320);
        const goalX = (lx / d) * 70 * m;
        const goalY = (ly / d) * 42 * m;
        // sacada: só pula quando o alvo se afasta; senão microssacadas
        if (Math.hypot(goalX - gx, goalY - gy) > 9) {
          gx = goalX;
          gy = goalY;
        } else if (now > nextMicro) {
          gx = goalX + (Math.random() - 0.5) * 6;
          gy = goalY + (Math.random() - 0.5) * 5;
          nextMicro = now + rand(220, 640);
        }
      }
    } else if (!b.look) {
      gx = 0;
      gy = 0;
    }
    if (ant && now < ant.until) headGoal = head.x + ant.dir * c.width * 0.02;
    else ant = null;

    springStep(px, gx, 0.035, dt);
    springStep(py, gy, 0.035, dt);
    springStep(hx, look ? 0 : gx * 0.25, 0.22, dt);
    springStep(head, headGoal, 0.24, dt);
    springStep(tilt, tiltGoal, 0.28, dt);
    springStep(mood, happy, 0.06, dt);

    const st = Math.min(Math.abs(head.v) * 0.0009, 0.035);
    const br = b.breathe ? Math.sin((now / 1000) * 1.75) * 0.011 : 0;
    const tx = head.x * k + hx.x;
    const rot = tilt.x + hx.x * 0.04 + head.x * 0.17 + head.v * 0.012;
    body?.setAttribute(
      "transform",
      `translate(${tx.toFixed(1)} 0) rotate(${rot.toFixed(2)} 640 1250) translate(640 1250) ` +
        `scale(${(1 / (1 + st)).toFixed(4)} ${((1 + st) * (1 + br)).toFixed(4)}) translate(-640 -1250)`,
    );
    const pt = `translate(${px.x.toFixed(1)} ${py.x.toFixed(1)})`;
    pupils.forEach((p) => p.setAttribute("transform", pt));
    draw();
    onHeadMove?.(tx / k);
    raf = requestAnimationFrame(frame);
  }

  function blink() {
    if (happy || live.current.reduce) return;
    eyes.forEach((e) => e.animate(BLINK, { duration: 300 }));
  }

  function ear(side?: "l" | "r") {
    if (live.current.reduce) return;
    const s = side ?? (Math.random() < 0.5 ? "l" : "r");
    const d = s === "l" ? -1 : 1;
    ears[s]?.animate(
      [
        { rotate: "0deg" },
        { rotate: `${d * 10}deg`, offset: 0.25 },
        { rotate: `${d * -4}deg`, offset: 0.55 },
        { rotate: `${d * 3}deg`, offset: 0.78 },
        { rotate: "0deg" },
      ],
      { duration: 520, easing: "ease-in-out" },
    );
  }

  function doTilt() {
    if (live.current.reduce) return;
    tiltGoal = (Math.random() < 0.5 ? -1 : 1) * rand(4, 7);
    later(() => (tiltGoal = 0), rand(1400, 2300));
  }

  function hop() {
    if (live.current.reduce) return;
    hopEl?.animate(HOP, { duration: 560, easing: "ease-in-out" });
    later(() => {
      ear("l");
      ear("r");
    }, 300);
  }

  function loop(fn: () => void, min: number, max: number, key: keyof MewBehaviors) {
    later(
      () => {
        if (live.current.behaviors[key]) fn();
        loop(fn, min, max, key);
      },
      rand(min, max),
    );
  }

  return {
    start() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
      loop(
        () => {
          if (look) return;
          if (Math.random() < 0.35) {
            gx = 0;
            gy = 0;
          } else {
            const a = Math.random() * Math.PI * 2;
            const r = rand(0.5, 1);
            gx = Math.cos(a) * 62 * r;
            gy = Math.sin(a) * 38 * r;
          }
          if (live.current.behaviors.blink && Math.random() < 0.25) blink();
        },
        900,
        2600,
        "look",
      );
      loop(
        () => {
          blink();
          if (Math.random() > 0.82) later(blink, 380);
        },
        2400,
        5600,
        "blink",
      );
      loop(ear, 3800, 8500, "ears");
      loop(doTilt, 6000, 12000, "tilt");
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      timers.forEach(clearTimeout);
      timers.clear();
      tiltGoal = 0;
    },
    setHappy(on: boolean) {
      happy = on ? 1 : 0;
      // parada (fora da tela ou reduced-motion): vai direto pro estado final
      if (!raf) {
        mood.x = happy;
        mood.v = 0;
        draw();
      }
    },
    blink,
    ear,
    tilt: doTilt,
    hop,
  };
}

export const Mew = forwardRef<MewHandle, MewProps>(function Mew(
  { className, behaviors, lookAt, headFollows = true, happy = false, title, onHeadMove },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(svgRef);
  const live = useRef<Live>({ behaviors: ALL_ON, lookAt, headFollows, reduce, onHeadMove });
  const ctl = useRef<ReturnType<typeof createMew> | null>(null);

  useEffect(() => {
    live.current = {
      behaviors: { ...ALL_ON, ...behaviors },
      lookAt,
      headFollows,
      reduce,
      onHeadMove,
    };
  });

  useEffect(() => {
    if (!svgRef.current) return;
    const c = createMew(svgRef.current, live);
    ctl.current = c;
    return () => c.stop();
  }, []);

  useEffect(() => {
    const c = ctl.current;
    if (!c || !inView || reduce) return;
    c.start();
    return () => c.stop();
  }, [inView, reduce]);

  useEffect(() => ctl.current?.setHappy(happy), [happy]);

  useImperativeHandle(
    ref,
    () => ({
      hop: () => ctl.current?.hop(),
      earFlick: (side) => ctl.current?.ear(side && (side === "left" ? "l" : "r")),
      tilt: () => ctl.current?.tilt(),
      blink: () => ctl.current?.blink(),
      setHappy: (on) => ctl.current?.setHappy(on),
    }),
    [],
  );

  return <MewArt ref={svgRef} className={className} title={title} />;
});
