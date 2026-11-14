import { useEffect, useId, useRef, type KeyboardEvent, type PointerEvent } from "react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DayPicker } from "@/components/dashboard/day-picker";
import { cn } from "@/lib/utils";
import { zoned } from "@/functions/zone";

// h-5 de cada linha; a roda tem h-16 e a linha do meio (py-5.5 acima e abaixo) é a escolhida.
const ROW_PX = 20;
const SETTLE_MS = 90;
const MINUTE_STEP = 5;
// O cilindro: cada linha longe do centro gira e apaga mais. Calibrado no olho.
const TILT_DEG = 20;
const FADE_PER_ROW = 0.3;
// Arrastar com o mouse só vira arrasto depois disto; antes é clique numa linha.
const DRAG_SLOP_PX = 3;
// Inércia ao soltar: a roda segue o quanto a velocidade andaria nisso e desacelera até a linha.
const MOMENTUM_MS = 260;
const GLIDE_PER_FRAME = 0.14;
const STILL_MS = 80;

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MERIDIEM = [0, 1];
const pad = (n: number) => String(n).padStart(2, "0");

/** Minutos de 5 em 5, mais o minuto atual se ele não cair num deles (16:37 não vira 16:35 sozinho). */
export function minuteOptions(current: number): number[] {
  const steps = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
  return steps.includes(current) ? steps : [...steps, current].sort((a, b) => a - b);
}

/**
 * Uma coluna da roda: rola com snap, a linha que para no centro é o valor. As linhas giram em
 * volta do centro (rotateX) pra ler como cilindro, e o mouse arrasta como o dedo.
 */
function Wheel({
  values,
  value,
  label,
  onChange,
  display = pad,
}: {
  values: number[];
  value: number;
  label: string;
  onChange: (value: number) => void;
  display?: (value: number) => string;
}): JSX.Element {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef(0);
  const frame = useRef(0);
  const drag = useRef<{
    y: number;
    top: number;
    moved: boolean;
    lastY: number;
    lastT: number;
    velocity: number;
  } | null>(null);
  const glide = useRef(0);
  const index = values.indexOf(value);

  // Direto no DOM, a cada quadro de rolagem: passar por estado re-renderizaria a coluna toda.
  const paint = () => {
    frame.current = 0;
    const el = ref.current;
    if (!el) return;
    for (const [i, row] of [...el.children].entries()) {
      if (!(row instanceof HTMLElement)) continue;
      const offset = i - el.scrollTop / ROW_PX;
      row.style.transform = `rotateX(${-offset * TILT_DEG}deg)`;
      row.style.opacity = String(Math.max(0, 1 - Math.abs(offset) * FADE_PER_ROW));
    }
  };

  // Valor vindo de fora (ou o primeiro render) posiciona a roda; a rolagem do usuário não passa
  // por aqui porque ela já está no lugar quando o onChange devolve o valor.
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ROW_PX) !== index) el.scrollTop = index * ROW_PX;
    paint();
  }, [index, values.length]);

  useEffect(() => () => cancelAnimationFrame(glide.current), []);

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next =
      values[Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ROW_PX)))];
    if (next !== value) onChange(next);
  };

  const onScroll = () => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
    if (drag.current) return;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(commit, SETTLE_MS);
  };

  const step = (delta: number) => {
    const next = values[index + delta];
    if (next === undefined) return;
    ref.current?.scrollTo({ top: (index + delta) * ROW_PX, behavior: "smooth" });
    onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    step(e.key === "ArrowUp" ? -1 : 1);
  };

  // O toque já rola nativo; o mouse precisa do arrasto na mão. Sem snap durante o arrasto (ele
  // puxaria a roda pra linha mais perto a cada pixel), e no soltar ela assenta na mais próxima.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    cancelAnimationFrame(glide.current);
    drag.current = {
      y: e.clientY,
      top: ref.current.scrollTop,
      moved: false,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
    };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < DRAG_SLOP_PX) return;
    if (!d.moved) {
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      el.style.scrollSnapType = "none";
    }
    el.scrollTop = d.top - dy;
    // px/ms do dedo, suavizada: um quadro parado antes de soltar não pode zerar o arremesso.
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = 0.8 * ((e.clientY - d.lastY) / dt) + 0.2 * d.velocity;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
  };
  const onPointerUp = () => {
    const el = ref.current;
    const d = drag.current;
    drag.current = null;
    if (!el || !d) return;
    // Um clique que interrompeu a inércia no meio: devolve o snap, e o clique escolhe a linha.
    if (!d.moved) {
      el.style.scrollSnapType = "";
      return;
    }
    // Escolhe já a linha onde a inércia pararia e desliza até ela, cada vez mais devagar.
    const max = (values.length - 1) * ROW_PX;
    // Parou o mouse antes de soltar: não é arremesso, a roda só assenta.
    const velocity = performance.now() - d.lastT > STILL_MS ? 0 : d.velocity;
    const projected = el.scrollTop - velocity * MOMENTUM_MS;
    const target = Math.min(max, Math.max(0, Math.round(projected / ROW_PX) * ROW_PX));
    // A posição anda em decimal aqui: o `scrollTop` arredonda, e um passo menor que 1px travava a
    // roda a poucos pixels da linha.
    let pos = el.scrollTop;
    let last = performance.now();
    const step = (now: number) => {
      const k = 1 - Math.pow(1 - GLIDE_PER_FRAME, Math.max(0, now - last) / 16.7);
      last = now;
      pos += (target - pos) * k;
      if (Math.abs(target - pos) < 0.5) {
        el.scrollTop = target;
        el.style.scrollSnapType = "";
        commit();
        return;
      }
      el.scrollTop = pos;
      glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
    // O clique que segue o soltar cairia numa linha e desfaria o arrasto.
    el.addEventListener("click", (event) => event.stopPropagation(), { capture: true, once: true });
  };

  return (
    <div
      ref={ref}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-activedescendant={`${id}-${value}`}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // A sombra do cilindro: as pontas somem num degradê, por cima do apagar de cada linha.
      style={{
        perspective: "240px",
        maskImage: "linear-gradient(to bottom, transparent, black 40%, black 60%, transparent)",
      }}
      className="relative h-16 w-10 cursor-grab snap-y snap-mandatory overflow-y-auto scrollbar-none py-5.5 outline-none select-none active:cursor-grabbing focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {values.map((v, i) => (
        <div
          key={v}
          id={`${id}-${v}`}
          role="option"
          aria-selected={v === value}
          onClick={() => step(i - index)}
          className={cn(
            "flex h-5 snap-center items-center justify-center font-mono text-sm transition-colors",
            v === value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {display(v)}
        </div>
      ))}
    </div>
  );
}

/** Roda fina de hora e minuto; em 12h (config) as horas vão de 1 a 12 e ganham AM/PM. */
export function TimeWheel({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}): JSX.Element {
  const { hour12 } = useDailify();
  const hours = value.getHours();
  const pm = hours >= 12 ? 1 : 0;

  const set = (h: number, minutes: number) => {
    const next = zoned(value);
    next.setHours(h, minutes, 0, 0);
    onChange(next);
  };

  return (
    <div className="relative flex items-center justify-center gap-1">
      {/* A faixa do meio marca a linha escolhida das colunas. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-5.5 h-5 rounded-md bg-surface-hover"
        aria-hidden="true"
      />
      <div className="relative flex items-center">
        {hour12 ? (
          <Wheel
            values={HOURS_12}
            value={hours % 12 || 12}
            label={copy.form.hour}
            onChange={(h) => set((h % 12) + pm * 12, value.getMinutes())}
          />
        ) : (
          <Wheel
            values={HOURS}
            value={hours}
            label={copy.form.hour}
            onChange={(h) => set(h, value.getMinutes())}
          />
        )}
        <span className="font-mono text-sm text-muted-foreground">:</span>
        <Wheel
          values={minuteOptions(value.getMinutes())}
          value={value.getMinutes()}
          label={copy.form.minute}
          onChange={(m) => set(hours, m)}
        />
        {hour12 && (
          <Wheel
            values={MERIDIEM}
            value={pm}
            label={copy.form.meridiem}
            display={(v) => (v ? "PM" : "AM")}
            onChange={(next) => set((hours % 12) + next * 12, value.getMinutes())}
          />
        )}
      </div>
    </div>
  );
}

/** Dia + hora: o calendário em cima, a roda embaixo. Trocar o dia mantém a hora. */
export function DateTimePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <DayPicker
        value={value}
        onSelect={(day) => {
          const next = zoned(day);
          next.setHours(value.getHours(), value.getMinutes(), 0, 0);
          onChange(next);
        }}
      />
      <div className="h-px bg-surface-line" aria-hidden="true" />
      <TimeWheel value={value} onChange={onChange} />
    </div>
  );
}
