import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

import { eyePath } from "./eye-path";
import { HEAD_D } from "./head-path";

const HEAD_T = "translate(0 1280) scale(.1 -.1)";
// olhos: cx, cy, rx, ry (coordenadas do viewBox)
export const EYES = [
  [463, 803, 152, 139],
  [1004, 752, 128, 138],
] as const;
const PUPILS = [
  [463, 806, 42],
  [1004, 752, 43],
] as const;
// orelhas soltas: `mask` tira a orelha da cabeça, `clip` recorta a orelha, `zone` impede que ela
// vaze abaixo da base (lá só aparece dentro da cabeça); `pivot` é a base, onde ela gira
const EARS = {
  l: {
    zone: "-300,-300 470,-300 470,322 -300,300",
    mask: "-20,-20 470,-20 470,290 120,330 -20,330",
    clip: "-20,-20 500,-20 500,360 60,580 -20,580",
    pivot: "450px 322px",
  },
  r: {
    zone: "700,-300 1600,-300 1600,345 715,296",
    mask: "700,-20 1300,-20 1300,330 1130,330 720,280",
    clip: "680,-20 1300,-20 1300,580 1170,580 690,350",
    pivot: "715px 296px",
  },
} as const;
const SIDES = ["l", "r"] as const;

// cores por tema; `onBrand` = sobre o vermelho, igual nos dois temas (cabeça branca, olhos pretos)
const TONES = {
  auto: {
    head: "fill-surface dark:fill-ink",
    eye: "fill-ink stroke-ink dark:fill-canvas dark:stroke-canvas",
    line: "text-ink-secondary dark:text-transparent",
  },
  onBrand: { head: "fill-on-brand", eye: "fill-black stroke-black", line: "text-transparent" },
} as const;

type ArtProps = {
  className?: string;
  title?: string;
  mood?: number;
  tone?: keyof typeof TONES;
};

/** A arte da Mew, sem comportamento. `Mew` anima as partes marcadas com `data-mew`. */
export const MewArt = forwardRef<SVGSVGElement, ArtProps>(function MewArt(
  { className, title, mood = 0, tone = "auto" },
  ref,
) {
  const { head: HEAD, eye: EYE, line } = TONES[tone];
  const id = useId().replace(/:/g, "");
  const head = <path className={HEAD} transform={HEAD_T} d={HEAD_D} />;
  return (
    <span
      className={cn("relative block", className)}
      // no claro o contorno sai da silhueta inteira (cabeça + orelhas soltas), não de cada pedaço
      style={{ filter: `url(#ml${id})` }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id={`ml${id}`} x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.8" result="d" />
          <feFlood floodColor="currentColor" className={line} />
          <feComposite in2="d" operator="in" result="r" />
          <feMerge>
            <feMergeNode in="r" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>
      <svg ref={ref} className="block w-full overflow-visible" viewBox="-160 -160 1600 1500">
        <defs>
          <mask
            id={`mh${id}`}
            maskUnits="userSpaceOnUse"
            x="-200"
            y="-200"
            width="1700"
            height="1700"
          >
            <rect x="-200" y="-200" width="1700" height="1700" fill="#fff" />
            {SIDES.map((k) => (
              <polygon key={k} points={EARS[k].mask} fill="#000" />
            ))}
          </mask>
          {SIDES.map((k) => (
            <clipPath key={`e${k}`} id={`me${k}${id}`}>
              <polygon points={EARS[k].clip} />
            </clipPath>
          ))}
          {SIDES.map((k) => (
            <clipPath key={`z${k}`} id={`mz${k}${id}`}>
              <polygon points={EARS[k].zone} />
              <path transform={HEAD_T} d={HEAD_D} />
            </clipPath>
          ))}
        </defs>
        <g data-mew="hop">
          <g data-mew="body">
            <g mask={`url(#mh${id})`}>{head}</g>
            {SIDES.map((k) => (
              <g key={k} clipPath={`url(#mz${k}${id})`}>
                <g data-mew={`ear-${k}`} style={{ transformOrigin: EARS[k].pivot }}>
                  <g clipPath={`url(#me${k}${id})`}>{head}</g>
                </g>
              </g>
            ))}
            {EYES.map(([cx, cy, rx, ry], i) => (
              <g key={i} data-mew="eye" style={{ transformOrigin: `${cx}px ${cy}px` }}>
                <path
                  data-mew="white"
                  className={EYE}
                  strokeLinejoin="round"
                  strokeWidth={mood * 34}
                  d={eyePath(cx, cy, rx, ry, mood)}
                />
                <ellipse
                  data-mew="pupil"
                  className={HEAD}
                  cx={PUPILS[i][0]}
                  cy={PUPILS[i][1]}
                  rx={PUPILS[i][2]}
                  ry={92}
                  opacity={Math.max(0, 1 - mood * 2.2)}
                />
              </g>
            ))}
            <ellipse className={EYE} cx="805" cy="951" rx="50" ry="30" />
          </g>
        </g>
      </svg>
    </span>
  );
});

/** Mew parada, pra logo e ícones pequenos. */
export function MewStatic(props: ArtProps & { happy?: boolean }) {
  const { happy, ...rest } = props;
  return <MewArt {...rest} mood={happy ? 1 : 0} />;
}
