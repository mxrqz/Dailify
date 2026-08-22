import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Flag, LinkIcon, RepeatIcon, TimerIcon } from "lucide-react";

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
/**
 * Chips de metadado: sem contorno — o hover do cartão apagava a hairline e a linha ficava
 * remendada. O que revela cada chip é o hover DELE, com o mesmo fundo do campo do título.
 * `pointer-events-auto` porque o cluster é `pointer-events-none` (o overlay do cartão é quem
 * recebe o clique lá).
 */
const chipClass =
  "pointer-events-auto inline-flex w-fit shrink-0 cursor-default items-center gap-1 " +
  "overflow-hidden rounded-md px-2 py-0.5 text-sm font-normal whitespace-nowrap " +
  "text-content-secondary transition-colors outline-none hover:bg-surface-panel " +
  "focus-visible:ring-[3px] focus-visible:ring-ring/50";

type ChipProps = ComponentPropsWithoutRef<"button"> & {
  editable?: boolean;
  label: string;
};

/**
 * Um chip é `<button>` quando edita e `<span>` quando é só leitura — o `<a>` do link à parte.
 *
 * Todos eles encaminham props e ref porque, no modo editável, o chip É o gatilho do menu: com
 * `asChild` o Radix clona este elemento, e um componente que engula `onClick`/`ref` vira um botão
 * que não abre nada (e um painel sem âncora, no React 18).
 */
const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { editable, label, className, children, ...props },
  ref,
) {
  const classes = cn(chipClass, className);
  if (!editable) {
    return (
      <span aria-label={label} className={classes}>
        {children}
      </span>
    );
  }
  return (
    <button ref={ref} type="button" aria-label={label} className={classes} {...props}>
      {children}
    </button>
  );
});

type MetaChipProps = Omit<ChipProps, "label" | "children">;

const LinkChip = forwardRef<HTMLButtonElement, { links: string[] } & MetaChipProps>(
  function LinkChip({ links, editable, ...props }, ref) {
    const [first, ...rest] = links;
    // Campo vazio não vira chip: quem oferece o que ainda não existe é a toolbar.
    if (!first) return null;

    const body = (
      <>
        <LinkIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden truncate sm:inline" aria-hidden="true">
          {linkLabel(first)}
        </span>
        {rest.length > 0 && <span className="shrink-0">+{rest.length}</span>}
      </>
    );

    // Sem edição o chip é o próprio atalho pra URL; com edição ele abre o painel, e é de lá que se
    // chega no link — um chip não pode responder a dois cliques diferentes.
    if (editable) {
      return (
        <Chip
          ref={ref}
          editable
          label={copy.task.editLinks}
          className="max-w-40 hover:text-foreground"
          {...props}
        >
          {body}
        </Chip>
      );
    }
    return (
      <a
        href={first}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label={linkLabel(first)}
        className={cn(chipClass, "max-w-40 hover:text-foreground")}
      >
        {body}
      </a>
    );
  },
);

/** Recorrência como chip: o rótulo já vem pronto do `repeatLabel` ("" = não repete). */
const RepeatChip = forwardRef<HTMLButtonElement, { label: string } & MetaChipProps>(
  function RepeatChip({ label, editable, ...props }, ref) {
    if (!label) return null;
    return (
      <Chip ref={ref} editable={editable} label={label} className="max-w-40" {...props}>
        <RepeatIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden truncate sm:inline" aria-hidden="true">
          {label}
        </span>
      </Chip>
    );
  },
);

/**
 * Prioridade como chip, igual aos vizinhos — antes era só a bandeira solta, o único metadado sem
 * contorno na linha. A cor fica na bandeira; o contorno segue neutro pra não virar semáforo.
 */
const PriorityChip = forwardRef<HTMLButtonElement, { priority?: number } & MetaChipProps>(
  function PriorityChip({ priority = 0, editable, ...props }, ref) {
    if (priority <= 0) return null;
    return (
      <Chip ref={ref} editable={editable} label={priorityText[priority]} {...props}>
        <Flag className={cn("size-3.5 shrink-0", priorityTextColor[priority])} aria-hidden="true" />
        <span className="hidden truncate sm:inline" aria-hidden="true">
          {priorityText[priority]}
        </span>
      </Chip>
    );
  },
);

/**
 * Toolbar da tarefa: as quatro ações SEMPRE, tenham valor ou não — é por aqui que se adiciona o que
 * a tarefa ainda não tem, sem o chip fantasma que fazia a linha piscar no hover. Flutua na borda de
 * cima do cartão, então não ocupa espaço na linha nem empurra nada.
 *
 * `pointer-events-none` junto com o `opacity-0`: invisível não pode continuar clicável. Fica de pé
 * enquanto algum menu dela estiver aberto (`has-[[data-state=open]]`), senão sumiria embaixo do
 * painel que ela mesma abriu assim que o mouse saísse do cartão.
 */
const toolbarClass =
  "pointer-events-none absolute -top-6 right-2 z-20 flex items-center gap-0.5 rounded-md " +
  "border border-surface-line bg-surface-panel p-0.5 opacity-0 shadow-elevation-1 " +
  "transition-opacity " +
  "group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto " +
  "focus-within:opacity-100 has-[[data-state=open]]:pointer-events-auto " +
  "has-[[data-state=open]]:opacity-100";

const ToolbarButton = forwardRef<
  HTMLButtonElement,
  { label: string; children: ReactNode } & ComponentPropsWithoutRef<"button">
>(function ToolbarButton({ label, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      {...props}
    >
      {children}
    </button>
  );
});

/** Chip de duração (mono) ou seu skeleton. */
const DurationChip = forwardRef<
  HTMLButtonElement,
  { value: string; loading?: boolean } & MetaChipProps
>(function DurationChip({ value, loading, editable, ...props }, ref) {
  if (loading) return <span className="skeleton block h-5 w-10 shrink-0 rounded-md" />;
  return (
    <Chip ref={ref} editable={editable} label={value} className="font-mono" {...props}>
      {value}
    </Chip>
  );
});

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
/** Recebe o chip pronto e devolve ele embrulhado no gatilho do editor. */
export type ChipEditor = (chip: JSX.Element) => JSX.Element;

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
  /** Renomear inline. Sem isto o título é texto puro — é o caso dos mocks da landing.
   *  Devolver `false` (erro do servidor) faz o campo voltar pro título antigo. */
  onTitleChange?: (title: string) => Promise<boolean>;
  /** Envolve cada chip no seu editor (menu/popover). O cartão só diz QUAL chip e em que ordem —
   *  o que abre e o que salva é problema de quem monta a lista. */
  edit?: {
    link?: ChipEditor;
    repeat?: ChipEditor;
    priority?: ChipEditor;
    duration?: ChipEditor;
  };
}

/**
 * Título editável no lugar: o campo se revela no hover e fica com o mesmo fundo enquanto está em
 * foco, então clicar não muda nada além do cursor. `surface-panel` é o mesmo fundo de campo do
 * composer, e cava um degrau ABAIXO do hover do cartão. Enter e clicar fora salvam, Esc desiste.
 * `-mx-2` cancela o `px-2` do campo pro texto não deslocar em relação ao cartão.
 */
function TitleField({
  title,
  completed,
  onTitleChange,
}: {
  title: string;
  completed?: boolean;
  onTitleChange: (title: string) => Promise<boolean>;
}): JSX.Element {
  const [draft, setDraft] = useState(title);
  const escaped = useRef(false);

  useEffect(() => setDraft(title), [title]);

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    if (!(await onTitleChange(next))) setDraft(title);
  };

  return (
    <input
      value={draft}
      // `size` é o fallback do `field-sizing-content` (baseline só desde jun/2026): sem ele um
      // navegador antigo daria a largura padrão de ~20 caracteres em vez da do texto.
      size={draft.length || 1}
      aria-label={copy.task.rename}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (escaped.current) {
          escaped.current = false;
          return;
        }
        void commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          escaped.current = true;
          setDraft(title);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        // 15ch de piso: com `field-sizing-content` um título curto encolhia o campo a quase nada e
        // sobrava um alvo de clique minúsculo pra editar.
        "relative z-10 -mx-2 min-w-[15ch] max-w-1/2 truncate rounded-md bg-transparent px-2 py-0.5",
        "field-sizing-content",
        "text-sm font-medium outline-none transition-colors",
        "hover:bg-surface-panel focus:bg-surface-panel",
        completed ? "text-muted-foreground line-through" : "text-foreground",
      )}
    />
  );
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
  onTitleChange,
  edit,
}: TaskCardProps) {
  const wrap = (editor: ChipEditor | undefined, chip: JSX.Element | null) =>
    chip && editor ? editor(chip) : chip;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Só renderiza com hora: um span vazio em coluna vira respiro morto acima do cartão. */}
      {time && (
        <span className="cursor-default font-mono text-2xs text-muted-foreground">{time}</span>
      )}

      <div
        className={cn(
          "group relative min-w-0 rounded-lg border bg-transparent px-3 py-2.5",
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
            className="absolute inset-0 z-0 cursor-default rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        )}

        {edit && (
          <div className={toolbarClass}>
            {wrap(
              edit.link,
              <ToolbarButton label={copy.task.editLinks}>
                <LinkIcon className="size-3.5" aria-hidden="true" />
              </ToolbarButton>,
            )}
            {wrap(
              edit.repeat,
              <ToolbarButton label={copy.task.editRepeat}>
                <RepeatIcon className="size-3.5" aria-hidden="true" />
              </ToolbarButton>,
            )}
            {wrap(
              edit.priority,
              <ToolbarButton label={copy.task.editPriority}>
                <Flag className="size-3.5" aria-hidden="true" />
              </ToolbarButton>,
            )}
            {wrap(
              edit.duration,
              <ToolbarButton label={copy.task.editDuration}>
                <TimerIcon className="size-3.5" aria-hidden="true" />
              </ToolbarButton>,
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {loading ? (
            <span className="skeleton h-3.5 w-32 rounded" />
          ) : onTitleChange ? (
            <TitleField title={title} completed={completed} onTitleChange={onTitleChange} />
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
            {!loading && wrap(edit?.link, <LinkChip links={links} editable={!!edit?.link} />)}
            {!loading &&
              wrap(edit?.repeat, <RepeatChip label={repeat} editable={!!edit?.repeat} />)}
            {!loading &&
              wrap(
                edit?.priority,
                <PriorityChip priority={priority} editable={!!edit?.priority} />,
              )}
            {loading ? (
              <DurationChip value={duration} loading />
            ) : (
              wrap(edit?.duration, <DurationChip value={duration} editable={!!edit?.duration} />)
            )}
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
  // `grid-cols-1` (= `minmax(0, 1fr)`), não a coluna implícita `auto`: com `field-sizing:content` o
  // campo do título contribui com o texto inteiro pro max-content da track — e o `max-w-1/2` dele é
  // porcentagem, ignorada nessa conta — então a track auto esticava o cartão.
  return (
    <div className="grid grid-cols-1">
      <motion.div
        aria-hidden
        className="pointer-events-none col-start-1 row-start-1 min-w-0"
        initial={false}
        animate={{ opacity: loading ? 1 : 0 }}
        transition={transition}
      >
        <CardBody {...data} loading />
      </motion.div>
      <motion.div
        className="col-start-1 row-start-1 min-w-0"
        initial={false}
        animate={{ opacity: loading ? 0 : 1 }}
        transition={transition}
      >
        <CardBody
          {...data}
          onClick={loading ? undefined : data.onClick}
          actions={loading ? undefined : data.actions}
          onTitleChange={loading ? undefined : data.onTitleChange}
          edit={loading ? undefined : data.edit}
        />
      </motion.div>
    </div>
  );
}
