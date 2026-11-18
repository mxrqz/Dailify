import { CheckIcon } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { type ComponentType, type SVGProps, useEffect, useRef, useState } from "react";

import { GoogleCalendarLogo } from "@/components/logos";
import { Mew } from "@/components/mew/mew";
import { ease } from "@/consts/motion";
import { cn } from "@/lib/utils";

import { copy } from "./copy";
import {
  GitHubLogo,
  GmailLogo,
  GoogleDriveLogo,
  MicrosoftTeamsLogo,
  NotionLogo,
  SlackLogo,
  ZoomLogo,
} from "./logos";

type App = {
  name: string;
  Logo: ComponentType<SVGProps<SVGSVGElement>>;
  // cor da marca do app (vem do logo dele, não do DS); sem cor = traço `ink`
  color?: string;
  mono?: boolean;
};

// grade 3×3 em ordem de leitura; a Mew é o centro (índice 4)
const APPS: (App | null)[] = [
  { name: copy.apps.googleCalendar, Logo: GoogleCalendarLogo, color: "#4285F4" },
  { name: copy.apps.gmail, Logo: GmailLogo, color: "#EA4335" },
  { name: copy.apps.slack, Logo: SlackLogo, color: "#E01E5A" },
  { name: copy.apps.github, Logo: GitHubLogo, mono: true },
  null,
  { name: copy.apps.notion, Logo: NotionLogo },
  { name: copy.apps.zoom, Logo: ZoomLogo, color: "#2D8CFF" },
  { name: copy.apps.googleDrive, Logo: GoogleDriveLogo, color: "#1FA463" },
  { name: copy.apps.microsoftTeams, Logo: MicrosoftTeamsLogo, color: "#5059C9" },
];
// sentido horário a partir do canto de cima à esquerda
const ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
// centros das células num viewBox de 248 (3×72 + 2×16); md (80/18) e lg (96/20) têm ~a mesma proporção
const CELL = [36, 124, 212];
const MID = CELL[1];

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((ok, fail) => {
    const stop = () => {
      clearTimeout(t);
      fail(signal.reason);
    };
    const t = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      ok();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });

const at = (i: number) => [CELL[i % 3], CELL[Math.floor(i / 3)]] as const;

export function WorldV2() {
  const gridRef = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLSpanElement | null)[]>([]);
  const target = useRef<Element | null>(null);
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(gridRef, { margin: "64px" });
  // `done` = apps acesos, `linked` = linhas já completas, ambos contando na ORDER
  const [done, setDone] = useState(0);
  const [linked, setLinked] = useState(0);
  const [drawing, setDrawing] = useState(-1);
  const [look, setLook] = useState(-1);
  const [happy, setHappy] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (reduce || !inView) return;
    const ac = new AbortController();
    const s = ac.signal;
    // a Mew fica parada no centro: só olha pro app enquanto a linha sai dela até ele
    (async () => {
      for (;;) {
        await wait(700, s);
        for (let k = 0; k < ORDER.length; k++) {
          const i = ORDER[k];
          target.current = tiles.current[i];
          setLook(i);
          await wait(260, s);
          setDrawing(i);
          await wait(420, s);
          setDone(k + 1);
          setLinked(k + 1);
          setDrawing(-1);
          await wait(260, s);
          setLook(-1);
        }
        target.current = null;
        setHappy(true);
        await wait(1800, s);
        setHappy(false);
        setFading(true);
        await wait(420, s);
        setFading(false);
        setDone(0);
        setLinked(0);
      }
    })().catch(() => {});
    return () => {
      ac.abort();
      target.current = null;
      setLook(-1);
      setDone(0);
      setLinked(0);
      setDrawing(-1);
      setHappy(false);
      setFading(false);
    };
  }, [reduce, inView]);

  // reduced motion: o quadro final, tudo conectado
  const lit = (i: number) => reduce || (!fading && ORDER.indexOf(i) < done);
  const joined = (i: number) => reduce || ORDER.indexOf(i) < linked;
  const tile = "size-18 md:size-20 lg:size-24";

  return (
    <section className="px-5 pb-16 md:pb-28">
      <div className="mx-auto grid max-w-6xl justify-items-center gap-9 rounded-sheet bg-surface px-5 pt-10 pb-11 text-center md:grid-cols-2 md:items-center md:gap-10 md:px-14 md:py-16 md:text-left lg:gap-16 lg:px-20 lg:py-20">
        <div className="flex flex-col items-center gap-4 md:items-start md:justify-self-start">
          <h2 className="text-4xl font-bold tracking-tight text-balance lg:text-5xl">
            {copy.title}
          </h2>
          <p className="max-w-85 text-base text-pretty text-ink-secondary md:max-w-md md:text-lg">
            {copy.body}
          </p>
        </div>
        <div ref={gridRef} className="relative grid grid-cols-3 gap-4 md:gap-4.5 lg:gap-5">
          <svg
            viewBox="0 0 248 248"
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 size-full overflow-visible transition-opacity duration-420",
              fading && "opacity-0",
            )}
          >
            {APPS.map((app, i) => {
              if (!app || !(joined(i) || drawing === i)) return null;
              const [x, y] = at(i);
              return (
                <motion.path
                  key={i}
                  d={`M${MID} ${MID}L${x} ${y}`}
                  initial={drawing === i ? { pathLength: 0 } : false}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.42, ease: ease.outQuint }}
                  stroke={app.color}
                  className={cn("fill-none stroke-2 opacity-55", !app.color && "stroke-ink")}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 z-3 w-12 -translate-1/2 md:w-13 lg:w-16"
          >
            <Mew
              lookAt={target}
              headFollows={false}
              happy={happy || reduce}
              behaviors={{ look: false, tilt: false }}
            />
          </div>
          {APPS.map((app, i) =>
            app ? (
              <span
                key={i}
                ref={(el) => {
                  tiles.current[i] = el;
                }}
                role="img"
                aria-label={app.name}
                className={cn(
                  "relative z-2 grid place-items-center rounded-lg bg-surface-raised shadow-raised transition-[scale] duration-520 ease-spring",
                  tile,
                  look === i && "scale-105",
                )}
              >
                <app.Logo
                  aria-hidden="true"
                  className={cn(
                    "size-7.5 transition-[filter,opacity] duration-420 ease-out md:size-8.5 lg:size-10",
                    app.mono && "fill-ink",
                    lit(i) ? "opacity-100" : "opacity-40 grayscale",
                  )}
                />
                <em
                  aria-hidden="true"
                  className={cn(
                    "absolute -top-1.25 -right-1.25 grid size-4.5 place-items-center rounded-full bg-brand text-on-brand transition-[scale] duration-520 ease-spring lg:size-5",
                    lit(i) ? "scale-100" : "scale-0",
                  )}
                >
                  <CheckIcon className="size-2.75 stroke-3 lg:size-3" />
                </em>
              </span>
            ) : (
              <span key={i} className={tile} />
            ),
          )}
        </div>
      </div>
    </section>
  );
}
