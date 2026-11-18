import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Loader2Icon, MicIcon, SquareIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import type { Field } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Chip } from "@/components/kit/chip";
import { copy as kitCopy } from "@/components/kit/copy";
import { BUBBLE_FILTER, BubbleDefs } from "@/components/landing/kit/bubble";
import { Ears } from "@/components/landing/kit/ears";
import { Tail } from "@/components/landing/kit/tail";
import { copy as mewChatCopy } from "@/components/mew-chat/copy";
import { Mew } from "@/components/mew/mew";
import { MewStatic } from "@/components/mew/mew-static";
import { Button } from "@/components/ui/button";
import type { Segment } from "@/functions/compose-input";
import { fill } from "@/functions/functions";
import { cn } from "@/lib/utils";

// As peças da criação, só props → markup: o `TaskComposer` liga nos hooks, as stories em mocks.

/** Topo da folha: ação à esquerda, título no meio (o rótulo do diálogo é o `SheetTitle` de quem abre). */
export function ComposerHeader({ start }: { start?: ReactNode }): JSX.Element {
  return (
    <div className="-mx-2 grid h-11 grid-cols-[1fr_auto_1fr] items-center">
      <span className="justify-self-start">{start}</span>
      <p aria-hidden="true" className="text-body font-semibold">
        {copy.composer.open}
      </p>
    </div>
  );
}

/** O botão de texto do topo (Cancelar, Voltar). */
export function HeaderButton(props: ComponentPropsWithoutRef<"button">): JSX.Element {
  return <Button type="button" variant="ghost" className="px-2 text-body font-normal" {...props} />;
}

const UNDERLINE: Record<Field, string> = {
  day: "decoration-meta-date",
  time: "decoration-meta-time",
  repeat: "decoration-meta-repeat",
  duration: "decoration-ink-secondary",
  links: "decoration-ink-secondary",
};

/**
 * A frase, com o que foi lido sublinhado na cor do campo. O espelho fica no fluxo e dá a altura
 * (o campo cresce com o texto); o textarea por cima, com a mesma fonte, é transparente pra ele —
 * caret, seleção, IME e autofill continuam sendo do campo de verdade.
 */
export const ComposerField = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<"textarea"> & { marks: Segment[]; large?: boolean }
>(function ComposerField({ marks, large, className, ...props }, ref) {
  return (
    <div
      className={cn(
        "relative",
        large
          ? "mt-4 min-h-17 text-2xl/8.5 font-medium"
          : "rounded-field border border-separator bg-canvas px-3.5 py-3 text-base focus-within:border-brand-text",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none whitespace-pre-wrap text-transparent wrap-break-word"
      >
        {marks.map(({ text, field, unsure }, i) =>
          field || unsure ? (
            <mark
              key={i}
              className={cn(
                "bg-transparent text-transparent underline decoration-2",
                large ? "underline-offset-6" : "underline-offset-4",
                unsure ? "decoration-ink-tertiary decoration-dotted" : field && UNDERLINE[field],
              )}
            >
              {text}
            </mark>
          ) : (
            text
          ),
        )}
        {/* Uma linha mesmo vazio: o espelho é quem dá a altura. */}
        {"\u200B"}
      </div>
      {/* text-base: abaixo de 16px o iOS dá zoom na página ao focar o campo. */}
      <textarea
        ref={ref}
        rows={1}
        autoComplete="off"
        enterKeyHint="send"
        className={cn(
          "absolute inset-0 block resize-none overflow-hidden bg-transparent text-ink outline-none placeholder:text-ink-tertiary",
          !large && "px-3.5 py-3",
        )}
        {...props}
      />
    </div>
  );
});

/**
 * O que o parser entendeu, numa linha só. Na folha (`large`) ela flutua logo acima do vidro e rola
 * de lado: chip que entra não empurra o texto. No desktop quebra linha embaixo do campo.
 */
export function ChipStrip({
  large,
  children,
}: {
  large?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      aria-live="polite"
      aria-label={copy.composer.understood}
      className={cn(
        "flex items-center gap-2",
        large
          ? "absolute inset-x-0 bottom-full scrollbar-none overflow-x-auto px-4 pt-3 pb-2.5"
          : "flex-wrap pt-2.5",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Um chip da faixa: tocar abre o `editor` do campo; o × (ou Backspace no chip) tira o campo. Sem
 * `onRemove` é o fantasma ("+ dia"), que só edita; sem `editor`, só mostra (o lembrete).
 */
export function MetaChip({
  large,
  ghost,
  icon,
  editLabel,
  removeLabel,
  onRemove,
  editor,
  children,
}: {
  large?: boolean;
  ghost?: boolean;
  icon?: ReactNode;
  editLabel?: string;
  removeLabel?: string;
  onRemove?: () => void;
  editor?: (trigger: JSX.Element) => JSX.Element;
  children: ReactNode;
}): JSX.Element {
  const look = cn(
    large && "bg-surface-raised shadow-raised hover:bg-surface-raised",
    ghost &&
      (large
        ? "text-ink-secondary"
        : "bg-transparent text-ink-secondary ring-1 ring-separator ring-inset"),
  );
  if (!editor)
    return (
      <span
        className={cn(
          "inline-flex flex-none items-center gap-1.5 rounded-sm bg-fill px-3 font-medium whitespace-nowrap tabular-nums [&_svg]:size-4",
          large ? "h-9 text-subhead" : "h-8 text-footnote",
          look,
        )}
      >
        {icon}
        {children}
      </span>
    );

  return editor(
    <Chip
      size={large ? "default" : "sm"}
      icon={icon}
      aria-label={editLabel}
      onRemove={onRemove}
      removeLabel={removeLabel}
      onKeyDown={(e) => {
        if (!onRemove || (e.key !== "Backspace" && e.key !== "Delete")) return;
        e.preventDefault();
        onRemove();
      }}
      className={look}
    >
      {children}
    </Chip>,
  );
}

/**
 * "Melhorar com a Mew · 1 crédito", largura toda, com o porquê da dúvida e os créditos embaixo.
 * Sem créditos, o "Assinar" mora ao lado (um link não cabe dentro do botão).
 */
export function MewCard({
  pending,
  disabled,
  hints,
  exhausted,
  onClick,
}: {
  pending?: boolean;
  disabled?: boolean;
  /** Linha de baixo: o motivo da dúvida e/ou "N restantes", cada um no seu span. */
  hints: string[];
  exhausted?: boolean;
  onClick: () => void;
}): JSX.Element {
  const id = useId();
  const lines = exhausted ? [copy.mew.exhausted] : hints;

  return (
    <div className="mt-4 flex items-center rounded-md bg-fill">
      <button
        type="button"
        aria-label={pending ? copy.mew.pending : copy.mew.improve}
        aria-describedby={lines.length ? id : undefined}
        disabled={disabled}
        onClick={onClick}
        className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md py-2 pr-4 pl-3 text-left transition-colors duration-fast hover:bg-fill-pressed disabled:cursor-default disabled:hover:bg-transparent"
      >
        {pending ? (
          <Mew mood="thinking" className="w-5.5 flex-none" />
        ) : (
          <MewStatic className="w-5.5 flex-none" />
        )}
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-subhead font-semibold">
            {pending ? copy.mew.pending : copy.mew.improve}
          </span>
          {lines.length > 0 && (
            <small id={id} className="truncate text-footnote text-ink-secondary tabular-nums">
              {lines.map((line, i) => (
                <span key={line}>
                  {i > 0 && " · "}
                  <span>{line}</span>
                </span>
              ))}
            </small>
          )}
        </span>
      </button>
      {exhausted && (
        <Link
          to="/premium"
          aria-label={copy.mew.upgradeLabel}
          className="mr-2 flex h-11 items-center rounded-sm px-3 text-subhead font-semibold text-brand-text hover:bg-fill-pressed"
        >
          {copy.mew.upgrade}
        </Link>
      )}
    </div>
  );
}

/** O balão da Mew (o da landing): `surface-raised`, orelhinhas, setinha embaixo à esquerda. */
export function MewBubble({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">): JSX.Element {
  return (
    <div
      className={cn(
        "relative mt-9 rounded-lg bg-surface-raised pt-3.5 pr-1 pb-1.5 pl-4",
        className,
      )}
      style={{ filter: BUBBLE_FILTER }}
      {...props}
    >
      <BubbleDefs />
      <Ears />
      <Tail className="left-7 ml-0" />
      {children}
    </div>
  );
}

/** Uma linha de metadado do rascunho: ícone neutro + texto. */
export function DraftMeta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-footnote text-ink-secondary tabular-nums [&_svg]:size-3.5 [&_svg]:flex-none">
      {icon}
      {children}
    </span>
  );
}

export interface DraftView {
  title: string;
  /** As linhas de `DraftMeta` (quando, repetição, lembrete). */
  meta: ReactNode;
  /** A etiqueta Google Agenda da linha, se se aplica. */
  calendar?: ReactNode;
}

/** As tarefas que a Mew achou numa frase, pra conferir antes de criar (separador só entre elas). */
export function MewDrafts({ say, drafts }: { say: string; drafts: DraftView[] }): JSX.Element {
  return (
    <MewBubble>
      <p className="pr-3 text-body">{say}</p>
      <ul aria-label={copy.mew.drafts} className="mt-2 divide-y divide-separator pr-3">
        {drafts.map((draft, i) => (
          <li key={i} className="flex flex-col items-start gap-1 py-3">
            <span className="text-body font-semibold">{draft.title}</span>
            {draft.meta}
            {draft.calendar && <span className="mt-1.5">{draft.calendar}</span>}
          </li>
        ))}
      </ul>
    </MewBubble>
  );
}

/** A Mew de olho nos créditos, embaixo do balão. Parada: animada, refiltra o vidro todo quadro. */
export function MewCredits({ credits }: { credits: string | null }): JSX.Element {
  return (
    <div className="mt-4.5 ml-3.5 flex items-center gap-3">
      <MewStatic mood="happy" className="w-14 flex-none" />
      {credits && <span className="text-footnote text-ink-secondary tabular-nums">{credits}</span>}
    </div>
  );
}

/** A linha de baixo: um botão quadrado (o mic) opcional e a ação principal, largura toda. */
export function ComposerActions({
  large,
  start,
  children,
}: {
  large?: boolean;
  start?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        large ? "mt-auto pt-6 pb-3 *:flex-1" : "justify-end pt-3",
      )}
    >
      {start}
      {children}
    </div>
  );
}

export function MicButton({
  large,
  ...props
}: ComponentPropsWithoutRef<"button"> & { large?: boolean }): JSX.Element {
  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={copy.voice.record}
      className={cn("flex-none! px-0", large ? "size-13 rounded-md [&_svg]:size-5.5" : "size-11")}
      {...props}
    >
      <MicIcon aria-hidden="true" />
    </Button>
  );
}

const WAVE_BARS = 32;
// Forma de repouso (sem Web Audio ou com movimento reduzido): um envelope, não uma linha de pontos.
const REST = Array.from(
  { length: WAVE_BARS },
  (_, i) => 0.15 + 0.6 * Math.sin((i / (WAVE_BARS - 1)) * Math.PI) * Math.abs(Math.sin(i * 1.7)),
);

/**
 * A onda ao vivo da gravação: o volume de cada quadro entra pela direita. Escreve direto no DOM —
 * um render por quadro refaria o composer inteiro. Com movimento reduzido, fica parada.
 */
function VoiceWave({ analyser }: { analyser: AnalyserNode | null }): JSX.Element {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!analyser || reduce) return;
    const samples = new Uint8Array(analyser.fftSize);
    const levels = new Array<number>(WAVE_BARS).fill(0);
    let frame = requestAnimationFrame(function draw() {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      levels.shift();
      // Fala normal fica perto de 0,1–0,25 de RMS; ×4 leva ela pro alto da barra.
      levels.push(Math.min(1, Math.sqrt(sum / samples.length) * 4));
      levels.forEach((level, i) => bars.current[i]?.style.setProperty("scale", `1 ${level}`));
      frame = requestAnimationFrame(draw);
    });
    return () => cancelAnimationFrame(frame);
  }, [analyser, reduce]);

  return (
    <span role="img" aria-label={copy.voice.wave} className="mt-8 flex h-16 items-center gap-1">
      {Array.from({ length: WAVE_BARS }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          style={{ scale: `1 ${REST[i]}` }}
          className="h-full min-h-1 w-1 rounded-full bg-ink"
        />
      ))}
    </span>
  );
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Quanto já gravou, de quanto cabe. Conta desde que montou: monta junto com a gravação. */
function VoiceTimer({ maxMs }: { maxMs: number }): JSX.Element {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="mt-4 text-title-3 font-semibold tabular-nums">
      {clock(seconds)}{" "}
      <small className="text-subhead font-normal text-ink-secondary">
        {fill(copy.voice.timerOf, { max: clock(maxMs / 1000) })}
      </small>
    </p>
  );
}

/** A folha gravando (Mew ouvindo, onda, tempo) e, depois de parar, enviando (Mew pensando). */
export function VoiceSheet({
  sending,
  analyser,
  maxMs,
  onCancel,
  onStop,
}: {
  sending?: boolean;
  analyser: AnalyserNode | null;
  maxMs: number;
  onCancel: () => void;
  onStop: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center text-center">
      <Mew mood={sending ? "thinking" : "listening"} className="mt-7 w-37" />
      <p className="mt-5 text-title-3 font-semibold">
        {sending ? copy.voice.sending : copy.voice.listening}
      </p>
      <p className="mt-1.5 text-body text-ink-secondary">{copy.voice.hint}</p>
      {sending ? (
        <Loader2Icon
          aria-label={copy.voice.sending}
          className="mt-8 mb-12 size-8 animate-spin text-ink-secondary"
        />
      ) : (
        <>
          <VoiceWave analyser={analyser} />
          <VoiceTimer maxMs={maxMs} />
        </>
      )}
      <div className="flex w-full gap-2.5 pt-9 pb-3">
        <Button
          variant="secondary"
          size="lg"
          aria-label={copy.voice.cancel}
          disabled={sending}
          onClick={onCancel}
          className="flex-1"
        >
          {kitCopy.cancel}
        </Button>
        <Button size="lg" disabled={sending} onClick={onStop} className="flex-1">
          <SquareIcon aria-hidden="true" className="size-4 fill-current" />
          {copy.voice.stop}
        </Button>
      </div>
    </div>
  );
}

/** The dock's round ink button: the mic, and the chat's send. */
export function DockButton({
  className,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button">): JSX.Element {
  return (
    <button
      type={type}
      className={cn(
        "relative grid size-11 flex-none cursor-pointer place-items-center rounded-full bg-ink text-canvas transition-[background-color,color,scale] duration-fast active:scale-95 disabled:cursor-default disabled:bg-fill-pressed disabled:text-ink-tertiary",
        className,
      )}
      {...props}
    />
  );
}

/**
 * O dock do mobile: pílula fixa embaixo com o "Ei Mewki, anota…" (abre o chat da Mew) e o mic
 * (abre já gravando). Um espaçador do mesmo tamanho no fluxo deixa a última tarefa rolar acima dele.
 * Mora num portal no `body`, na camada `z-dock`: acima do chat da Mew, abaixo das folhas e da gaveta.
 * Com `chat`, a mesma pílula vira a caixa de mensagem do chat aberto por baixo dela.
 */
export function CreateDock({
  onOpen,
  onVoice,
  chat,
  className,
}: {
  onOpen: () => void;
  onVoice?: () => void;
  chat?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <>
      <div aria-hidden="true" className="pb-dock">
        <div className="h-13" />
      </div>
      {/* Sem barra sólida: véu leve atrás da pílula (blur + aresta cromática no fim da tela). */}
      {createPortal(
        <div
          data-chat={chat ? "" : undefined}
          className={cn(
            "dock-veil pointer-events-none fixed inset-x-0 bottom-0 z-dock px-4 pb-dock",
            className,
          )}
        >
          <div
            data-slot="create-dock"
            className={cn(
              "pointer-events-auto relative flex h-13 items-center gap-2.5 rounded-full bg-surface-raised pr-1 pl-2.5 shadow-raised outline-1 -outline-offset-1 outline-card-edge dark:bg-fill dark:outline-fill-pressed",
              chat && "pl-1",
            )}
          >
            {chat || (
              <>
                <button
                  type="button"
                  aria-label={mewChatCopy.open}
                  onClick={onOpen}
                  className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left outline-none"
                >
                  <MewStatic className="ml-0.5 w-7 flex-none" />
                  <span className="truncate text-body text-ink-secondary">
                    {copy.composer.dock}
                  </span>
                </button>
                {onVoice && (
                  <DockButton aria-label={copy.composer.dockVoice} onClick={onVoice}>
                    <MicIcon aria-hidden="true" className="size-5" />
                  </DockButton>
                )}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
