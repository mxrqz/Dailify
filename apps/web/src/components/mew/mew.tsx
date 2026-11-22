import { useInView, useReducedMotion } from "motion/react";
import {
  type RefObject,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { GAZE, MOODS, type MewMood, MewArt, type Pose, poseAttrs, restPose } from "./mew-static";
import { type SpringState, springStep } from "./spring";

export type { MewMood } from "./mew-static";

export type MewBehaviors = {
  breathe: boolean;
  look: boolean;
  blink: boolean;
  ears: boolean;
  tilt: boolean;
};

export type MewHandle = {
  hop(): void;
};

export type MewProps = {
  className?: string;
  behaviors?: Partial<MewBehaviors>;
  /** Pupilas e cabeça seguem este elemento (como no hero). */
  lookAt?: RefObject<Element | null> | null;
  /** `false`: só as pupilas seguem o `lookAt` — pra quando quem move a Mew é o pai. */
  headFollows?: boolean;
  happy?: boolean;
  /** O humor: pose, olhar, ritmo e enfeites (ondas, pontinhos, zzz, "?"). */
  mood?: MewMood;
  /** Entra com um pulinho e acorda (a pálpebra abre). */
  enter?: boolean;
  /** Deslocamento horizontal da cabeça em px, a cada frame — pra `<Tail>` seguir sem re-render. */
  onHeadMove?: (px: number) => void;
  /** Frozen in its current pose: a still layer moves on the compositor without repainting. */
  paused?: boolean;
};

type Live = {
  behaviors: MewBehaviors;
  lookAt: RefObject<Element | null> | null | undefined;
  headFollows: boolean;
  reduce: boolean;
  mood: MewMood;
  enter: boolean;
  onHeadMove?: (px: number) => void;
};

const ALL_ON: MewBehaviors = { breathe: true, look: true, blink: true, ears: true, tilt: true };
const BLINK: Keyframe[] = [
  { transform: "scaleY(1)", easing: "cubic-bezier(.55,0,1,.45)" },
  { transform: "scaleY(.08)", offset: 0.3 },
  { transform: "scaleY(.08)", offset: 0.42, easing: "cubic-bezier(0,.55,.45,1)" },
  { transform: "scaleY(1)" },
];
const SLOW_BLINK: Keyframe[] = [
  { transform: "scaleY(1)" },
  { transform: "scaleY(.08)", offset: 0.3, easing: "ease-in" },
  { transform: "scaleY(.08)", offset: 0.55 },
  { transform: "scaleY(1)", easing: "ease-out" },
];
const POP: Keyframe[] = [
  { transform: "translate(0px,140px) scale(.55,.55)", opacity: 0 },
  { transform: "translate(0px,-40px) scale(.95,1.07)", opacity: 1, offset: 0.5 },
  { transform: "translate(0px,0px) scale(1.06,.94)", offset: 0.74 },
  { transform: "translate(0px,0px) scale(1,1)" },
];
const POSE: ReadonlyArray<keyof Pose> = [
  "joy",
  "lid",
  "dil",
  "px",
  "py",
  "hx",
  "hy",
  "tilt",
  "el",
  "er",
];
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

// Um controlador por gatinha: molas por meia-vida (iguais em 60/120Hz), WAAPI pros gestos curtos.
function createMew(svg: SVGSVGElement, live: { current: Live }) {
  const q = (k: string) => svg.querySelector<SVGGElement>(`[data-mew="${k}"]`);
  const all = (k: string) => Array.from(svg.querySelectorAll<SVGElement>(`[data-mew="${k}"]`));
  const hopEl = q("hop");
  const body = q("body");
  const headEl = q("head");
  const dot = q("dot");
  const ears = all("ear");
  const flicks = all("flick");
  const lids = all("lid");
  const blinks = all("blink");
  const whites = all("white");
  const pupils = all("pupil");
  const shuts = all("shut");

  const rest = restPose(live.current.mood);
  const S = (x = 0): SpringState => ({ x, v: 0 });
  const pose: Record<keyof Pose, SpringState> = {
    joy: S(rest.joy),
    lid: S(rest.lid),
    dil: S(rest.dil),
    px: S(rest.px),
    py: S(rest.py),
    hx: S(rest.hx),
    hy: S(rest.hy),
    tilt: S(rest.tilt),
    el: S(rest.el),
    er: S(rest.er),
  };
  const { joy, lid, dil, px, py, hx, hy, tilt, el, er } = pose;
  const head = S(); // cabeça seguindo o `lookAt` (px de tela)
  const dx = S(640); // o pontinho de laser (viewBox)
  const dy = S(1450);
  const dop = S();
  let mood = live.current.mood;
  let happy = false;
  let entering = live.current.enter && !live.current.reduce;
  let gx = rest.px;
  let gy = rest.py;
  let tiltExtra = 0;
  let peek = 0;
  let phase = 0;
  let wakeAt = 0;
  let darts = 0;
  let dT = [640, 1460];
  let drawnWhite = "";
  let last = 0;
  let raf = 0;
  let nextMicro = 0;
  let tLook = 0;
  let tBlink = 0;
  let tEar = 0;
  let tTilt = 0;
  let tPeek = 0;
  let tDot = 0;
  let look: Element | null = null;
  let ant: { until: number; dir: number } | null = null;
  let ptr: { x: number; y: number; t: number } | null = null;
  const timers = new Set<number>();
  const onPtr = (e: PointerEvent) => (ptr = { x: e.clientX, y: e.clientY, t: performance.now() });

  // com `enter` ela nasce escondida (antes da pintura) e só aparece no pulinho, já na tela
  if (entering && hopEl) hopEl.style.opacity = "0";

  function later(fn: () => void, ms: number) {
    const t = window.setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  }

  function draw() {
    const a = poseAttrs({
      joy: joy.x,
      lid: lid.x,
      dil: dil.x,
      px: px.x,
      py: py.x,
      hx: hx.x,
      hy: hy.x,
      tilt: tilt.x,
      el: el.x,
      er: er.x,
    });
    headEl?.setAttribute("transform", a.head);
    ears.forEach((e, i) => e.setAttribute("transform", a.ears[i]));
    lids.forEach((l, i) => {
      l.setAttribute("transform", a.lids[i]);
      l.setAttribute("opacity", a.lidOpacity);
    });
    shuts.forEach((s) => s.setAttribute("opacity", a.shut));
    pupils.forEach((p, i) => {
      p.setAttribute("transform", a.pupils[i]);
      p.setAttribute("opacity", a.pupilOpacity);
    });
    // o `d` do olho só muda com a alegria: reescrever todo frame refaria o path à toa
    if (a.whites[0] !== drawnWhite) {
      drawnWhite = a.whites[0];
      whites.forEach((w, i) => {
        w.setAttribute("d", a.whites[i]);
        w.setAttribute("stroke-width", a.whiteStroke);
      });
    }
  }

  // parada (fora da tela ou reduced-motion): vai direto pra pose final, sem mola
  function settle() {
    const goal = restPose(live.current.mood, happy);
    for (const k of POSE) {
      pose[k].x = goal[k];
      pose[k].v = 0;
    }
    draw();
  }

  function blink(slow = false) {
    if (joy.x > 0.3 || live.current.reduce) return;
    blinks.forEach((b) => b.animate(slow ? SLOW_BLINK : BLINK, { duration: slow ? 1100 : 300 }));
  }

  function ear(i = Math.random() < 0.5 ? 0 : 1) {
    if (live.current.reduce) return;
    const s = i === 0 ? -1 : 1;
    flicks[i]?.animate(
      [
        { rotate: "0deg" },
        { rotate: `${s * 7}deg`, offset: 0.25 },
        { rotate: `${-s * 3}deg`, offset: 0.55 },
        { rotate: `${s * 2}deg`, offset: 0.78 },
        { rotate: "0deg" },
      ],
      { duration: 520, easing: "ease-in-out" },
    );
  }

  function hop(toX = 0, h = 90) {
    if (live.current.reduce) return;
    hopEl?.animate(
      [
        { transform: "translate(0px,0px) scale(1,1)" },
        { transform: "translate(0px,0px) scale(1.06,.92)", offset: 0.2 },
        { transform: `translate(${toX}px,${-h}px) scale(.96,1.05)`, offset: 0.48 },
        { transform: "translate(0px,0px) scale(1.05,.95)", offset: 0.8 },
        { transform: "translate(0px,0px) scale(1,1)" },
      ],
      { duration: 560, easing: "ease-in-out" },
    );
    later(() => {
      ear(0);
      ear(1);
    }, 280);
  }

  function doTilt() {
    if (live.current.reduce) return;
    tiltExtra = (Math.random() < 0.5 ? -1 : 1) * rand(3, 6);
    later(() => (tiltExtra = 0), rand(1400, 2300));
  }

  function onMood(id: MewMood, now: number) {
    if (id === "happy") hop(0, 90);
    if (id === "alert") hop(0, 50);
    if (id === "listening") {
      ear(0);
      ear(1);
    }
    if (id === "confused") later(() => blink(true), 450);
    if (id === "loading") tDot = now + 300;
    tBlink = now + 900;
  }

  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const { behaviors: b, lookAt, headFollows, onHeadMove } = live.current;
    const id = live.current.mood;
    const p = MOODS[id];
    if (id !== mood) {
      onMood(id, now);
      mood = id;
    }
    const awake = now >= wakeAt;
    const c = svg.getBoundingClientRect();
    const k = 1600 / (c.width || 1);
    let headGoal = 0;

    const target = lookAt?.current ?? null;
    if (target !== look) {
      if (target && look) blink();
      if (target && headFollows) {
        const t = target.getBoundingClientRect();
        // antecipa: um tiquinho pro lado contrário antes de virar
        ant = { until: now + 90, dir: -Math.sign(t.left + t.width / 2 - (c.left + c.width / 2)) };
      }
      look = target;
    }
    const following = !!look?.isConnected;
    const hunting = !following && id === "loading" && awake;
    if (look && following) {
      const t = look.getBoundingClientRect();
      if (t.width + t.height > 0 && c.width > 0) {
        const lx = t.left + t.width / 2 - (c.left + c.width / 2);
        const ly = t.top + t.height / 2 - (c.top + c.height * 0.55);
        // proporcional ao tamanho: 46px fixos levavam a cabeça inteira de uma Mew pequena
        const maxHead = c.width * 0.35;
        if (headFollows) headGoal = clamp(lx * 0.3, -maxHead, maxHead);
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
    } else if (hunting) {
      gx = clamp((dx.x - 735) * 0.075, -62, 62);
      gy = clamp((dy.x - 790) * 0.06, -40, 40);
    } else if (p.look === "wander") {
      if (!b.look) {
        gx = 0;
        gy = 0;
      } else if (ptr && now - ptr.t < 2500 && c.width > 0) {
        gx = clamp(((ptr.x - (c.left + c.width / 2)) / c.width) * 110, -62, 62);
        gy = clamp(((ptr.y - (c.top + c.height * 0.53)) / c.height) * 80, -40, 40);
      } else if (now > tLook) {
        if (Math.random() < 0.35) {
          gx = 0;
          gy = 0;
        } else {
          const a = Math.random() * Math.PI * 2;
          const r = rand(0.5, 1);
          gx = Math.cos(a) * 62 * r;
          gy = Math.sin(a) * 38 * r;
        }
        tLook = now + rand(900, 2600);
      }
    } else if (p.look === "up") {
      if (now > tLook) {
        gx = GAZE.up[0] + rand(-16, 16);
        gy = GAZE.up[1] + rand(-8, 8);
        tLook = now + rand(500, 1300);
      }
    } else {
      [gx, gy] = GAZE[p.look];
    }
    if (ant && now < ant.until) headGoal = head.x + ant.dir * c.width * 0.02;
    else ant = null;

    // o pontinho de laser: descansa tremendo, dispara pra outro canto, às vezes em zigue-zague
    if (hunting && now > tDot) {
      const quick = Math.random() < 0.3;
      dT =
        Math.random() < 0.75
          ? [rand(-900, 2180), rand(1320, 1660)]
          : [Math.random() < 0.5 ? rand(-900, -420) : rand(1700, 2180), rand(300, 1200)];
      tDot = now + (quick ? rand(160, 260) : rand(650, 1500));
      darts += 1;
      if (!quick && darts % 4 === 0 && Math.random() < 0.6) {
        const toX = clamp((dT[0] - 640) * 0.12, -120, 120);
        later(() => hop(toX, 70), 140);
      }
    }
    if (p.blink && now > tBlink) {
      if (b.blink && awake && joy.x < 0.3 && lid.x < 0.5) {
        blink();
        if (Math.random() < 0.18) later(blink, 380);
      }
      tBlink = now + rand(p.blink[0], p.blink[1]);
    }
    if (now > tEar) {
      if (b.ears && p.flick && awake) ear();
      tEar = now + rand(3800, 8500);
    }
    if (p.look === "wander" && now > tTilt) {
      if (b.tilt) doTilt();
      tTilt = now + rand(6000, 12000);
    }
    if (id === "sleepy" && now > tPeek) {
      peek = 1;
      later(() => (peek = 0), 1300);
      tPeek = now + rand(6000, 10000);
    }

    const joyGoal = happy ? 1 : p.joy;
    const lx = joyGoal > 0.5 ? 0 : gx;
    const ly = joyGoal > 0.5 ? 0 : gy;
    springStep(joy, joyGoal, 0.06, dt);
    springStep(
      lid,
      !awake ? 1 : Math.max(0, p.lid - peek * 0.55),
      id === "sleepy" ? 0.18 : 0.07,
      dt,
    );
    springStep(dil, p.dil, 0.12, dt);
    springStep(px, lx, 0.035, dt);
    springStep(py, ly, 0.035, dt);
    springStep(hx, following ? 0 : lx * 0.25, 0.22, dt);
    springStep(hy, following ? 0 : ly * 0.2, 0.25, dt);
    springStep(head, headGoal, 0.24, dt);
    springStep(tilt, p.tilt + tiltExtra + (hunting ? lx * 0.06 : 0), 0.28, dt);
    springStep(el, p.ears[0], 0.12, dt);
    springStep(er, p.ears[1], 0.12, dt);
    springStep(dop, hunting ? 1 : 0, 0.06, dt);
    const tremor = Math.sin(now * 0.021) * 6 + Math.sin(now * 0.037) * 4;
    springStep(dx, dT[0] + tremor, 0.045, dt);
    springStep(dy, dT[1] + tremor * 0.6, 0.045, dt);

    phase += (dt * Math.PI * 2) / p.breath[0];
    const br = b.breathe ? Math.sin(phase) * p.breath[1] : 0;
    const st = Math.min(Math.abs(head.v) * 0.0009, 0.035);
    body?.setAttribute(
      "transform",
      `translate(${(head.x * k).toFixed(1)} 0) rotate(${(head.x * 0.17 + head.v * 0.012).toFixed(2)} 640 1250) ` +
        `translate(640 1250) scale(${((1 - br * 0.4) / (1 + st)).toFixed(4)} ${((1 + st) * (1 + br)).toFixed(4)}) translate(-640 -1250)`,
    );
    draw();
    dot?.setAttribute("cx", dx.x.toFixed(1));
    dot?.setAttribute("cy", dy.x.toFixed(1));
    dot?.setAttribute("opacity", clamp(dop.x, 0, 1).toFixed(3));
    onHeadMove?.(head.x + hx.x / k);
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (raf) return;
      last = performance.now();
      if (entering) {
        entering = false;
        hopEl?.style.removeProperty("opacity");
        hopEl?.animate(POP, { duration: 720, easing: "cubic-bezier(.3,0,.2,1)" });
        lid.x = 1;
        wakeAt = last + 480;
        later(() => {
          ear(0);
          ear(1);
        }, 620);
      }
      tBlink = last + 1200;
      tEar = last + 2500;
      tTilt = last + 5000;
      tPeek = last + 4000;
      tDot = Math.max(last, wakeAt) + 300;
      window.addEventListener("pointermove", onPtr, { passive: true });
      raf = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      timers.forEach(clearTimeout);
      timers.clear();
      tiltExtra = 0;
      peek = 0;
      window.removeEventListener("pointermove", onPtr);
    },
    sync() {
      if (!raf) settle();
    },
    setHappy(on: boolean) {
      happy = on;
      if (!raf) settle();
    },
    hop,
  };
}

export const Mew = forwardRef<MewHandle, MewProps>(function Mew(
  {
    className,
    behaviors,
    lookAt,
    headFollows = true,
    happy = false,
    mood = "idle",
    enter = false,
    onHeadMove,
    paused = false,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(svgRef, { margin: "64px" });
  const live = useRef<Live>({
    behaviors: { ...ALL_ON, ...behaviors },
    lookAt,
    headFollows,
    reduce,
    mood,
    enter,
    onHeadMove,
  });
  const ctl = useRef<ReturnType<typeof createMew> | null>(null);
  // a pose do primeiro render; depois os atributos são do controlador (re-render não os pisa)
  const [pose] = useState(() => restPose(mood, happy));

  useEffect(() => {
    live.current = {
      behaviors: { ...ALL_ON, ...behaviors },
      lookAt,
      headFollows,
      reduce,
      mood,
      enter,
      onHeadMove,
    };
  });

  // layout effect: o `enter` esconde a Mew antes da primeira pintura
  useLayoutEffect(() => {
    if (!svgRef.current) return;
    const c = createMew(svgRef.current, live);
    ctl.current = c;
    return () => c.stop();
  }, []);

  useEffect(() => {
    const c = ctl.current;
    if (!c || !inView || reduce || paused) return;
    c.start();
    return () => c.stop();
  }, [inView, reduce, paused]);

  useEffect(() => ctl.current?.setHappy(happy), [happy]);
  useEffect(() => ctl.current?.sync(), [mood]);

  useImperativeHandle(
    ref,
    () => ({
      hop: () => ctl.current?.hop(),
    }),
    [],
  );

  return <MewArt ref={svgRef} className={className} mood={mood} pose={pose} />;
});
