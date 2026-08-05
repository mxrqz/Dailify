import { motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Cena "horários" do painel do hero (activeWord===1): o dia como coluna cronometrada. As MESMAS
 * tarefas da cena de lista, agora encaixadas num eixo de tempo proporcional — altura do bloco ∝
 * duração, o bloco que contém o "agora" em accent, e a linha do agora cruzando a coluna com pulso.
 * Vende literalmente "suas tarefas → seus horários". Mock decorativo, sem relógio real.
 *
 * Geometria: minutos-desde-meia-noite mapeados numa janela fixa (WINDOW_*) pra altura do track.
 * `MIN_H` garante que blocos curtos (20/30min) continuem legíveis — mesmo truque de calendário real.
 * `reduce` colapsa pro estado final (blocos postos, linha parada, sem pulso).
 */

const WINDOW_START = 525; // 08:45 — início da janela visível
const WINDOW_END = 765; // 12:45
const RANGE = WINDOW_END - WINDOW_START;
const TRACK_H = 320; // px (== h-80); casa ~ com a altura da lista da cena de tarefas
const MIN_H = 40; // altura mínima legível de um bloco
const AGORA_MIN = 592; // 09:52 — cai dentro da "Reunião de time"

const pad = (n: number): string => String(n).padStart(2, "0");
const label = (min: number): string => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

interface Slot {
  title: string;
  startMin: number;
  durMin: number;
  durLabel: string;
}

const SLOTS: readonly Slot[] = [
  { title: "Revisar proposta", startMin: 540, durMin: 30, durLabel: "30min" },
  { title: "Reunião de time", startMin: 570, durMin: 45, durLabel: "45min" },
  { title: "Escrever relatório", startMin: 630, durMin: 90, durLabel: "1h30" },
  { title: "Deploy da build", startMin: 735, durMin: 20, durLabel: "20min" },
] as const;

const HOUR_TICKS = [540, 600, 660, 720] as const; // 09..12

const yOf = (min: number): number => ((min - WINDOW_START) / RANGE) * TRACK_H;
const hOf = (dur: number): number => Math.max(MIN_H, (dur / RANGE) * TRACK_H);
const isNow = (s: Slot): boolean => s.startMin <= AGORA_MIN && AGORA_MIN < s.startMin + s.durMin;

/** Meta pro widget "Agora / A seguir" do box (task-options), derivada do mesmo schedule. */
const nextSlot = SLOTS.find((s) => s.startMin > AGORA_MIN);
export const scheduleMeta = {
  nowLabel: label(AGORA_MIN),
  next: nextSlot
    ? { title: nextSlot.title, timeLabel: label(nextSlot.startMin), durLabel: nextSlot.durLabel }
    : null,
};

const EXPO = [0.16, 1, 0.3, 1] as const; // ease-out-expo

const trackVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};
const blockVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EXPO } },
};

export function SceneHorarios({ reduce }: { reduce: boolean }): JSX.Element {
  return (
    <div className="relative h-80 w-full">
      {/* eixo de horas: label + hairline por hora (some com a cena, sem stagger) */}
      {HOUR_TICKS.map((min) => (
        <div
          key={min}
          className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2"
          style={{ top: yOf(min) }}
        >
          <span className="w-7 shrink-0 text-right font-mono text-2xs text-muted-foreground">
            {pad(Math.floor(min / 60))}
          </span>
          <span className="h-px flex-1 bg-surface-line" />
        </div>
      ))}

      {/* blocos encaixados na hora, altura ∝ duração — entram em stagger cima→baixo */}
      <motion.div
        variants={trackVariants}
        initial={reduce ? "visible" : "hidden"}
        animate="visible"
        className="absolute inset-0"
      >
        {SLOTS.map((s) => {
          const now = isNow(s);
          return (
            <motion.div
              key={s.title}
              variants={blockVariants}
              className={cn(
                "absolute left-9 right-1 flex items-start justify-between gap-2 overflow-hidden rounded-lg border py-2 pl-3 pr-2.5",
                now
                  ? "border-accent-primary bg-accent-subtle"
                  : "border-surface-line bg-transparent",
              )}
              style={{ top: yOf(s.startMin), height: hOf(s.durMin) }}
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0 w-0.5 rounded-l",
                  now ? "bg-accent-primary" : "bg-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  "truncate text-sm font-medium",
                  now ? "text-foreground" : "text-content-secondary",
                )}
              >
                {s.title}
              </span>
              <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                {s.durLabel}
              </span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* linha do agora cruzando a coluna — fade-in atrasado + pulso suave */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center gap-2"
        style={{ top: yOf(AGORA_MIN) }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: EXPO, delay: reduce ? 0 : 0.5 }}
      >
        <span className="size-1.5 shrink-0 rounded-full bg-accent-primary shadow-[0_0_5px_var(--accent-glow)]" />
        <motion.span
          className="h-px flex-1 bg-accent-primary shadow-[0_0_6px_var(--accent-glow)]"
          animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="shrink-0 font-mono text-2xs tracking-[0.08em] text-accent-primary">
          AGORA
        </span>
      </motion.div>
    </div>
  );
}
