import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Flag, LinkIcon, RepeatIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
/**
 * Labels de acessibilidade (sr-only) pro `completed` e `priority` — estados que só existem no app.
 * Mocks da landing passam só os 4 campos base e nunca atingem este código, então a dependência
 * transativa do landing no dicionário do dashboard é segura e inevitável.
 */
import { copy } from "@/components/dashboard/copy";
import { priorityText, priorityTextColor } from "@/consts/conts";
import { linkLabel } from "@/functions/link-label";
import { cn } from "@/lib/utils";

/**
 * Cartão de task (mock decorativo do hero, mas modelado como componente real reutilizável).
 * O cartão cabe em UMA linha: título truncado à esquerda, e à direita os metadados na ordem
 * link → repetição → prioridade → duração → menu. `TagBadge` continua exportado pros mocks da
 * landing, mas o cartão não mostra tags — elas vivem na edição.
 *
 * Cada peça é auto-contida: recebe `loading` e renderiza o próprio skeleton — o crossfade
 * skeleton→conteúdo mora no TaskCard, então nada dessincroniza. Sem `loading`/timer interno:
 * o pai controla quando resolve.
 */

const EXPO = [0.16, 1, 0.3, 1] as const; // ease-out-expo

/** Uma tag como badge outline neutro (ou seu skeleton). */
export function TagBadge({ label, loading }: { label: string; loading?: boolean }): JSX.Element {
  if (loading) return <span className="skeleton block h-5 w-12 rounded-md" />;
  return (
    <Badge
      variant="outline"
      className="border-surface-line px-2 py-0.5 text-2xs font-normal text-content-secondary"
    >
      {label}
    </Badge>
  );
}

/**
 * Um link só, mesmo quando a tarefa tem vários: o cartão informa que existe link e leva pro
 * primeiro (o da reunião, na prática); o resto vive na edição. `+N` conta o que ficou de fora.
 * `pointer-events-auto` + z acima do overlay: clicar aqui abre a URL, não o detalhe da tarefa.
 */
function LinkChip({ links }: { links: string[] }): JSX.Element | null {
  const [first, ...rest] = links;
  if (!first) return null;
  return (
    <a
      href={first}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto max-w-40"
    >
      <Badge
        variant="outline"
        className="gap-1 border-surface-line px-2 py-0.5 text-2xs font-normal text-content-secondary transition-colors hover:border-accent-primary hover:text-foreground"
      >
        <LinkIcon className="size-2.5 shrink-0" aria-hidden="true" />
        <span className="hidden truncate sm:inline">{linkLabel(first)}</span>
        {rest.length > 0 && <span className="shrink-0">+{rest.length}</span>}
      </Badge>
    </a>
  );
}

/** Recorrência como chip: o rótulo já vem pronto do `repeatLabel` ("" = não repete). */
function RepeatChip({ label }: { label: string }): JSX.Element | null {
  if (!label) return null;
  return (
    <Badge
      variant="outline"
      className="max-w-40 gap-1 border-surface-line px-2 py-0.5 text-2xs font-normal text-content-secondary"
    >
      <RepeatIcon className="size-2.5 shrink-0" aria-hidden="true" />
      <span className="hidden truncate sm:inline">{label}</span>
    </Badge>
  );
}

/** Badge de duração (outline, transparente) ou seu skeleton. */
function DurationBadge({ value, loading }: { value: string; loading?: boolean }): JSX.Element {
  if (loading) return <span className="skeleton block h-5 w-10 shrink-0 rounded-md" />;
  return (
    <Badge
      variant="outline"
      className="shrink-0 border-surface-line bg-transparent px-2 py-0.5 font-mono text-2xs text-content-secondary"
    >
      {value}
    </Badge>
  );
}

export interface TaskCardData {
  time: string;
  title: string;
  duration: string;
  tags: string[];
}

/**
 * O cartão nasceu como mock da landing (só os 4 campos de `TaskCardData`). Tudo abaixo é
 * capacidade do app e é OPCIONAL — a landing continua passando os 4 campos e não muda.
 */
export interface TaskCardProps extends TaskCardData {
  /** Skeleton com crossfade pro conteúdo. */
  loading?: boolean;
  /** Borda crimson — a tarefa cuja sheet está aberta. */
  selected?: boolean;
  /** Concluída neste dia: título riscado + check verde. */
  completed?: boolean;
  /** 0–4; só aparece a partir de 1 (0 = "sem prioridade" não merece ícone). */
  priority?: number;
  /** Abre o detalhe. Vira um overlay clicável — ver nota de acessibilidade no corpo. */
  onClick?: () => void;
  /** Menu (⋮) do app, à direita da duração. Fica FORA do overlay clicável. */
  actions?: ReactNode;
  /** URLs da tarefa; vira UM chip (o primeiro + `+N`). */
  links?: string[];
  /** Rótulo pronto da recorrência (`repeatLabel`); "" = não repete, sem chip. */
  repeat?: string;
}

/** Corpo do card — mesma estrutura em loading/ready (alturas casam, sem jump no crossfade). */
function CardBody({
  time,
  title,
  duration,
  loading,
  selected,
  completed,
  priority,
  onClick,
  actions,
  links = [],
  repeat = "",
}: TaskCardProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* Só renderiza com hora: um span vazio em coluna vira respiro morto acima do cartão. */}
      {time && <span className="font-mono text-2xs text-muted-foreground">{time}</span>}

      <div
        className={cn(
          "relative min-w-0 rounded-lg border bg-transparent px-3 py-2.5",
          selected && !loading ? "border-accent-primary" : "border-surface-line",
          onClick && !loading && "transition-colors hover:bg-surface-hover",
        )}
      >
        {/* Overlay clicável em vez de envolver tudo num <button>: `actions` também é um botão, e
            botão dentro de botão é HTML inválido. O overlay dá teclado e foco de graça; `actions`
            fica acima dele no z, então o clique no menu não abre o detalhe. */}
        {onClick && !loading && (
          <button
            type="button"
            onClick={onClick}
            aria-label={title}
            className="absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        )}

        <div className="flex items-center justify-between gap-2">
          {loading ? (
            <span className="skeleton h-3.5 w-32 rounded" />
          ) : (
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-medium",
                completed ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {title}
            </span>
          )}

          <div className="pointer-events-none relative z-10 flex shrink-0 items-center gap-1.5">
            {!loading && completed && (
              <>
                <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                <span className="sr-only">{copy.task.completed}</span>
              </>
            )}
            {!loading && <LinkChip links={links} />}
            {!loading && <RepeatChip label={repeat} />}
            {!loading && priority !== undefined && priority > 0 && (
              <>
                <Flag
                  className={cn("size-3 shrink-0", priorityTextColor[priority])}
                  aria-hidden="true"
                />
                <span className="sr-only">{priorityText[priority]}</span>
              </>
            )}
            <DurationBadge value={duration} loading={loading} />
            {!loading && actions && <span className="pointer-events-auto">{actions}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Card completo. Skeleton e conteúdo ficam EMPILHADOS na mesma célula do grid (col/row-start-1) e
 * a opacidade cruza simultaneamente em `loading` — dissolve suave de um pro outro, sem "some depois
 * entra". Mesma estrutura dos dois lados, então a altura casa e não há jump. `initial={false}`: sem
 * fade no mount (a entrada em stagger é do pai); aqui anima só o resolve skeleton→conteúdo.
 */
export function TaskCard({ loading, ...data }: TaskCardProps): JSX.Element {
  const reduce = useReducedMotion();
  const transition = { duration: reduce ? 0 : 0.45, ease: EXPO };
  return (
    <div className="grid">
      <motion.div
        aria-hidden
        className="pointer-events-none col-start-1 row-start-1"
        initial={false}
        animate={{ opacity: loading ? 1 : 0 }}
        transition={transition}
      >
        <CardBody {...data} loading />
      </motion.div>
      <motion.div
        className="col-start-1 row-start-1"
        initial={false}
        animate={{ opacity: loading ? 0 : 1 }}
        transition={transition}
      >
        <CardBody
          {...data}
          onClick={loading ? undefined : data.onClick}
          actions={loading ? undefined : data.actions}
        />
      </motion.div>
    </div>
  );
}
