import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

import { eyePath } from "./eye-path";
import { HEAD_D } from "./head-path";
import "./mew.css";

type Mood = {
  blink: readonly [number, number] | null;
  look: "wander" | "dot" | "front" | "up" | "side";
  dil: number;
  lid: number;
  joy: number;
  tilt: number;
  ears: readonly [number, number];
  breath: readonly [number, number];
  flick: boolean;
};

// Cada humor é um conjunto de parâmetros; respirar, piscar, olhar e orelhas só leem daqui.
export const MOODS = {
  idle: {
    blink: [3500, 7000],
    look: "wander",
    dil: 1,
    lid: 0,
    joy: 0,
    tilt: 0,
    ears: [0, 0],
    breath: [3.6, 0.011],
    flick: true,
  },
  loading: {
    blink: [2000, 4000],
    look: "dot",
    dil: 1.35,
    lid: 0,
    joy: 0,
    tilt: 0,
    ears: [5, -5],
    breath: [2.4, 0.012],
    flick: true,
  },
  listening: {
    blink: [6000, 9000],
    look: "front",
    dil: 1.25,
    lid: 0,
    joy: 0,
    tilt: 0,
    ears: [6, -6],
    breath: [3.0, 0.008],
    flick: false,
  },
  thinking: {
    blink: [2200, 3800],
    look: "up",
    dil: 0.9,
    lid: 0.22,
    joy: 0,
    tilt: -6,
    ears: [-2, 4],
    breath: [3.6, 0.01],
    flick: true,
  },
  happy: {
    blink: null,
    look: "front",
    dil: 1,
    lid: 0,
    joy: 1,
    tilt: 0,
    ears: [4, -4],
    breath: [2.2, 0.014],
    flick: false,
  },
  sleepy: {
    blink: null,
    look: "front",
    dil: 1,
    lid: 0.94,
    joy: 0,
    tilt: 5,
    ears: [-7, 7],
    breath: [5.2, 0.02],
    flick: false,
  },
  confused: {
    blink: [3000, 5000],
    look: "side",
    dil: 0.78,
    lid: 0.12,
    joy: 0,
    tilt: 11,
    ears: [0, 10],
    breath: [3.6, 0.01],
    flick: false,
  },
  alert: {
    blink: [6000, 9000],
    look: "front",
    dil: 1.42,
    lid: 0,
    joy: 0,
    tilt: 0,
    ears: [8, -8],
    breath: [1.6, 0.01],
    flick: false,
  },
} satisfies Record<string, Mood>;
export type MewMood = keyof typeof MOODS;

// pra onde o olhar descansa em cada modo (o `wander` e o `dot` a `Mew` decide a cada frame)
export const GAZE = {
  wander: [0, 0],
  dot: [0, 0],
  front: [0, 0],
  up: [40, -30],
  side: [-50, 8],
} as const;

/** O estado contínuo da Mew; `Mew` anima cada campo com uma mola. */
export type Pose = {
  joy: number;
  lid: number;
  dil: number;
  px: number;
  py: number;
  hx: number;
  hy: number;
  tilt: number;
  el: number;
  er: number;
};

/** Pose parada de um humor: onde as molas da `Mew` assentam. */
export function restPose(mood: MewMood, happy = false): Pose {
  const p = MOODS[mood];
  const joy = happy ? 1 : p.joy;
  const [gx, gy] = joy > 0.5 ? [0, 0] : GAZE[p.look];
  const [el, er] = p.ears;
  return {
    joy,
    lid: p.lid,
    dil: p.dil,
    px: gx,
    py: gy,
    hx: gx * 0.25,
    hy: gy * 0.2,
    tilt: p.tilt,
    el,
    er,
  };
}

// olhos: cx, cy, rx, ry (coordenadas do viewBox)
export const EYES = [
  [463, 803, 152, 139],
  [1004, 752, 128, 138],
] as const;
const PUPILS = [
  [463, 806, 42],
  [1004, 752, 43],
] as const;
const HEAD_T = "translate(0 1280) scale(.1 -.1)";
// A cabeça é recortada por dois domos (arcos sobre a base de cada orelha). Cada orelha é a mesma
// silhueta recortada por polígono + círculo do domo, desenhada atrás da cabeça e girando no centro
// dele: em qualquer ângulo a base continua coberta, sem fresta nem dente.
const DOME =
  "M56 580A278.4 278.4 0 0 1 443.8 316.2L520 150L690 150L740 291.6A260.5 260.5 0 0 1 1133.8 454.2L1500 454.2L1500 1500L-300 1500L-300 580Z";
const SEAM = "M56 580A278.4 278.4 0 0 1 443.8 316.2M740 291.6A260.5 260.5 0 0 1 1133.8 454.2";
const EARS = [
  { clip: "M56 580L443.8 316.2L560 -400L-400 -400L-400 580Z", cx: 334.3, cy: 572.1, r: 278.4 },
  {
    clip: "M740 291.6L1133.8 454.2L1700 454.2L1700 -400L640 -400Z",
    cx: 879.7,
    cy: 511.5,
    r: 260.5,
  },
] as const;
const SHUT = ["M343 800Q463 880 583 800", "M904 750Q1004 830 1104 750"];
const WAVES = [
  "M1300 300q60 70 0 140",
  "M1360 250q100 120 0 240",
  "M-20 300q-60 70 0 140",
  "M-80 250q-100 120 0 240",
];
const THINK = [
  [1170, 150, 30],
  [1268, 50, 40],
  [1385, -70, 52],
] as const;
const ZZ = [
  [1120, 230, 150],
  [1215, 100, 200],
  [1320, -50, 250],
] as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const around = (x: number, y: number, t: string) =>
  `translate(${x} ${y}) ${t} translate(${-x} ${-y})`;

/** Atributos de cada parte numa pose: a mesma conta pra arte parada e pro frame da `Mew`. */
export function poseAttrs(s: Pose) {
  // fechado de verdade (sono, acordando) vira o arco; a piscada rápida só achata o olho
  const shut = clamp01((s.lid - 0.55) / 0.3);
  const joy = clamp01(s.joy);
  const squash = `scale(1 ${(1 - s.lid * 0.92).toFixed(3)})`;
  const dil = `scale(${s.dil.toFixed(3)} ${(1 + (s.dil - 1) * 0.3).toFixed(3)})`;
  const look = `translate(${s.px.toFixed(1)} ${s.py.toFixed(1)})`;
  return {
    head: `translate(${s.hx.toFixed(1)} ${s.hy.toFixed(1)}) rotate(${(s.tilt + s.hx * 0.04).toFixed(2)} 640 1250)`,
    ears: [s.el, s.er].map((a, i) => `rotate(${a.toFixed(2)} ${EARS[i].cx} ${EARS[i].cy})`),
    lids: EYES.map(([cx, cy]) => around(cx, cy, squash)),
    lidOpacity: (1 - shut).toFixed(3),
    shut: shut.toFixed(3),
    whites: EYES.map(([cx, cy, rx, ry]) => eyePath(cx, cy, rx, ry, joy)),
    whiteStroke: (joy * 34).toFixed(1),
    pupils: EYES.map(([cx, cy]) => `${look} ${around(cx, cy, dil)}`),
    // a pupila tem a cor da cabeça: com o olho fechado ela cortaria a linha ao meio
    pupilOpacity: (Math.max(0, 1 - joy * 2.2) * clamp01((0.75 - s.lid) / 0.35)).toFixed(3),
  };
}

// cores por tema; `onBrand` = sobre o vermelho, igual nos dois temas (cabeça branca, olhos pretos).
// `line` é o contorno do claro: no escuro a cabeça clara já se separa do fundo.
const TONES = {
  auto: {
    head: "fill-surface dark:fill-ink",
    eye: "fill-ink dark:fill-canvas",
    ink: "stroke-ink dark:stroke-canvas",
    line: "stroke-ink-secondary dark:stroke-transparent",
  },
  onBrand: {
    head: "fill-on-brand",
    eye: "fill-black",
    ink: "stroke-black",
    line: "stroke-transparent",
  },
} as const;

type ArtProps = {
  className?: string;
  title?: string;
  mood?: MewMood;
  happy?: boolean;
  /** Pose inicial dos atributos (a `Mew` passa a dela e daí em diante os anima). */
  pose?: Pose;
  tone?: keyof typeof TONES;
};

/** A arte da Mew, sem comportamento. `Mew` anima as partes marcadas com `data-mew`. */
export const MewArt = forwardRef<SVGSVGElement, ArtProps>(function MewArt(
  { className, title, mood = "idle", happy = false, pose, tone = "auto" },
  ref,
) {
  const { head: HEAD, eye: EYE, ink, line } = TONES[tone];
  const id = useId().replace(/:/g, "");
  const a = poseAttrs(pose ?? restPose(mood, happy));
  const outline = { strokeWidth: 2.4, vectorEffect: "non-scaling-stroke" } as const;
  const head = (className: string) => (
    <path className={className} transform={HEAD_T} d={HEAD_D} strokeLinejoin="round" {...outline} />
  );
  return (
    <span
      data-mood={mood}
      className={cn("mew relative block", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg ref={ref} className="block w-full overflow-visible" viewBox="-160 -160 1600 1500">
        <defs>
          <clipPath id={`mh${id}`}>
            <path d={DOME} />
          </clipPath>
          {EARS.map((e, i) => (
            <clipPath key={i} id={`me${i}${id}`}>
              <path d={e.clip} />
              <circle cx={e.cx} cy={e.cy} r={e.r} />
            </clipPath>
          ))}
        </defs>
        <g data-mew="hop" style={{ transformOrigin: "640px 1290px" }}>
          <g data-mew="body">
            <g data-mew="head" transform={a.head}>
              {/* claro: contorno por baixo, orelhas com o próprio contorno, recheio por cima */}
              <path className={cn("fill-none", line)} d={SEAM} {...outline} />
              <g clipPath={`url(#mh${id})`}>{head(cn("fill-none", line))}</g>
              {EARS.map((e, i) => (
                <g key={i} data-mew="ear" transform={a.ears[i]}>
                  <g data-mew="flick" style={{ transformOrigin: `${e.cx}px ${e.cy}px` }}>
                    <g clipPath={`url(#me${i}${id})`} paintOrder="stroke">
                      {head(cn(HEAD, line))}
                    </g>
                  </g>
                </g>
              ))}
              <g clipPath={`url(#mh${id})`}>{head(cn(HEAD, "stroke-none"))}</g>
              {EYES.map(([cx, cy], i) => (
                <g key={cx}>
                  <g data-mew="lid" transform={a.lids[i]} opacity={a.lidOpacity}>
                    <g data-mew="blink" style={{ transformOrigin: `${cx}px ${cy}px` }}>
                      <path
                        data-mew="white"
                        className={cn(EYE, ink)}
                        strokeLinejoin="round"
                        strokeWidth={a.whiteStroke}
                        d={a.whites[i]}
                      />
                      <ellipse
                        data-mew="pupil"
                        className={HEAD}
                        cx={PUPILS[i][0]}
                        cy={PUPILS[i][1]}
                        rx={PUPILS[i][2]}
                        ry={92}
                        transform={a.pupils[i]}
                        opacity={a.pupilOpacity}
                      />
                    </g>
                  </g>
                  <path
                    data-mew="shut"
                    className={ink}
                    fill="none"
                    strokeWidth={30}
                    strokeLinecap="round"
                    d={SHUT[i]}
                    opacity={a.shut}
                  />
                </g>
              ))}
              <ellipse className={EYE} cx="805" cy="951" rx="50" ry="30" />
              <g className="mew-x mew-waves">
                {WAVES.map((d) => (
                  <path
                    key={d}
                    className="fill-none stroke-brand-text"
                    strokeWidth={44}
                    strokeLinecap="round"
                    d={d}
                  />
                ))}
              </g>
              <g className="mew-x mew-think">
                {THINK.map(([cx, cy, r]) => (
                  <circle key={cx} className="fill-ink-secondary" cx={cx} cy={cy} r={r} />
                ))}
              </g>
              <g className="mew-x mew-zz">
                {ZZ.map(([x, y, size]) => (
                  <text
                    key={x}
                    className="fill-ink-secondary font-bold"
                    x={x}
                    y={y}
                    fontSize={size}
                  >
                    z
                  </text>
                ))}
              </g>
              <g className="mew-q">
                <text className="fill-ink font-bold" x="1170" y="250" fontSize="400">
                  ?
                </text>
              </g>
            </g>
          </g>
        </g>
        {/* o pontinho de laser do `loading` (fica fora da cabeça: ela o persegue) */}
        <circle data-mew="dot" className="fill-brand" cx="640" cy="1450" r="34" opacity="0" />
      </svg>
    </span>
  );
});

/** Mew parada, pra logo e ícones pequenos. */
export function MewStatic(props: Omit<ArtProps, "pose">) {
  return <MewArt {...props} />;
}
