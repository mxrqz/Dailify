import { motion } from "framer-motion";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { tagsBgColors2 } from "@/consts/conts";
import { cn } from "@/lib/utils";

/**
 * Cartão de task (mock decorativo do hero, mas modelado como componente real reutilizável).
 * `TaskCard` compõe `TagBadge` + `TagDots`. Cada um é auto-contido: recebe `loading` e renderiza
 * o próprio skeleton — o crossfade skeleton→conteúdo mora no TaskCard (`AnimatePresence` em `loading`),
 * então nada dessincroniza. Sem `loading`/timer interno: o pai controla quando resolve.
 *
 * Cores: badge de tag é outline neutro (mastra); a cor de tag vive só nos dots (`bg-tag-N`,
 * índice-based, igual ao app real via `tagsBgColors2`). O dot "+" é neutro.
 */

const MAX_TAGS = 3; // tags mostradas como badge antes de colapsar no cluster de dots
const MAX_DOTS = 3; // dots coloridos antes do "+"
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
 * Cluster de dots pro overflow de tags: um dot colorido (`bg-tag-N`) por tag além das 3 mostradas,
 * no máximo `MAX_DOTS`; se sobrar mais, um dot "+" neutro no fim. `startIndex` = índice da 1ª tag
 * escondida (mantém a cor de cada dot alinhada à cor que a tag teria como badge).
 */
export function TagDots({
  extra,
  startIndex = MAX_TAGS,
  loading,
}: {
  extra: number;
  startIndex?: number;
  loading?: boolean;
}): JSX.Element | null {
  if (extra <= 0) return null;
  if (loading) return <span className="skeleton block h-5 w-11 rounded-md" />;
  const colored = Math.min(extra, MAX_DOTS);
  return (
    <Badge variant="outline" className="gap-0 border-surface-line px-2 py-0.5">
      {/* dots sobrepostos (avatar-stack): ring da cor do fundo separa, direita fica por cima */}
      {Array.from({ length: colored }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "-ml-0.5 size-1.5 rounded-full ring-2 ring-surface-card first:ml-0",
            tagsBgColors2[(startIndex + i) % tagsBgColors2.length],
          )}
        />
      ))}
      {extra > MAX_DOTS && <Plus className="ml-1 size-1.5 text-muted-foreground" />}
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

/** Corpo do card — mesma estrutura em loading/ready (alturas casam, sem jump no crossfade). */
function CardBody({ time, title, tags, duration, loading }: TaskCardData & { loading?: boolean }) {
  const shown = tags.slice(0, MAX_TAGS);
  const extra = tags.length - shown.length;
  return (
    <div className="flex items-start gap-3">
      <span className="w-12 shrink-0 pt-2.5 text-right font-mono text-2xs text-muted-foreground">
        {time}
      </span>

      <div className="min-w-0 flex-1 rounded-lg border border-surface-line bg-transparent px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {loading ? (
            <span className="skeleton h-3.5 w-32 rounded" />
          ) : (
            <span className="truncate text-sm font-medium text-foreground">{title}</span>
          )}
          <DurationBadge value={duration} loading={loading} />
        </div>

        {(shown.length > 0 || extra > 0) && (
          <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
            {shown.map((tag, i) => (
              <TagBadge key={i} label={tag} loading={loading} />
            ))}
            <TagDots extra={extra} startIndex={MAX_TAGS} loading={loading} />
          </div>
        )}
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
export function TaskCard({ loading, ...data }: TaskCardData & { loading?: boolean }): JSX.Element {
  return (
    <div className="grid">
      <motion.div
        aria-hidden
        className="pointer-events-none col-start-1 row-start-1"
        initial={false}
        animate={{ opacity: loading ? 1 : 0 }}
        transition={{ duration: 0.45, ease: EXPO }}
      >
        <CardBody {...data} loading />
      </motion.div>
      <motion.div
        className="col-start-1 row-start-1"
        initial={false}
        animate={{ opacity: loading ? 0 : 1 }}
        transition={{ duration: 0.45, ease: EXPO }}
      >
        <CardBody {...data} />
      </motion.div>
    </div>
  );
}
