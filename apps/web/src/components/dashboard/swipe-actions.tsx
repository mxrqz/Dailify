import { useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent } from "framer-motion";
import { CheckIcon, Trash2Icon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { cn } from "@/lib/utils";

/**
 * Distância pra ação valer: um quarto da largura do cartão, com teto em pixels — a fração sozinha
 * viraria um gesto absurdo num tablet. É a faixa que as listas com arrasto usam (80–100px).
 */
const THRESHOLD = 0.25;
const MAX_DISTANCE = 96;

/**
 * Um empurrão rápido também vale, mesmo sem percorrer a distância: é assim que essas listas se
 * comportam em todo lugar, e sem isto o gesto natural (um flick curto) não dispara nada.
 * `FLICK_MIN` existe pra um toque trêmulo não virar flick.
 */
const FLICK_VELOCITY = 400;
const FLICK_MIN = 24;

type Armed = "complete" | "delete" | null;

/** Alpha da cor, não uma mistura sólida: o painel fica ATRÁS do cartão, e translúcido é o que lê
 *  como "atrás" — verde é concluir, vermelho é excluir, e a diferença tem que ser óbvia no gesto. */
const panelClass = "flex w-full shrink-0 items-center rounded-lg transition-colors";

/**
 * Arrastar o cartão pro lado no toque: pra direita conclui, pra esquerda exclui. É o que substitui
 * o menu (⋮) no celular, onde o alvo dele é pequeno demais pro polegar.
 *
 * Os painéis são IRMÃOS do cartão numa fileira de três, cada um do tamanho dele, e não blocos
 * absolutos parados atrás: eles moram fora da faixa visível e entram empurrados pelo mesmo arrasto,
 * como uma folha puxada pra dentro da tela. Quem recorta o que está fora é o `overflow-hidden`.
 *
 * `dragDirectionLock`: sem isso o gesto disputaria com a rolagem da lista e o dia inteiro travaria
 * a cada tentativa de descer a tela. `dragMomentum={false}` tira a inércia do fim do gesto, pra que
 * onde o dedo larga seja onde o cartão está quando a volta começa.
 */
export function SwipeActions({
  onComplete,
  onDelete,
  children,
}: {
  onComplete: () => void;
  onDelete: () => void;
  children: ReactNode;
}): JSX.Element {
  const track = useRef<HTMLDivElement>(null);
  const width = useRef(0);
  const armedRef = useRef<Armed>(null);
  const [armed, setArmed] = useState<Armed>(null);
  const x = useMotionValue(0);

  /**
   * O gesto "arma" ao cruzar o limiar, e é aí que o painel acende e o aparelho dá um pulso: soltar
   * antes disso não faz nada, e sem o aviso o usuário só descobria o que ia acontecer depois de
   * acontecer. O ref é o que evita um `setState` a cada pixel do arrasto.
   */
  useMotionValueEvent(x, "change", (value) => {
    const distance = Math.min(width.current * THRESHOLD, MAX_DISTANCE);
    const next: Armed = value > distance ? "complete" : value < -distance ? "delete" : null;
    if (next === armedRef.current) return;
    armedRef.current = next;
    setArmed(next);
    // Só o Android tem `vibrate`; no iOS a chamada simplesmente não existe.
    if (next) navigator.vibrate?.(12);
  });

  return (
    <div ref={track} className="overflow-hidden">
      <motion.div
        drag="x"
        dragDirectionLock
        dragMomentum={false}
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        // 1 = o cartão acompanha o dedo. Com resistência (0.35) ele andava um terço do gesto, então
        // a distância da ação só chegava se o dedo cruzasse a tela inteira — impossível na mão.
        dragElastic={1}
        onDragStart={() => {
          width.current = track.current?.offsetWidth ?? 0;
        }}
        onDragEnd={(_, info) => {
          const action = armedRef.current ?? flick(info.offset.x, info.velocity.x);
          armedRef.current = null;
          setArmed(null);
          // A volta é ANIMADA POR NÓS e a ação só roda quando ela termina. Deixar o `dragSnapToOrigin`
          // cuidar disso não funciona aqui: `setTasks` re-renderiza a linha e o snap interno morre no
          // meio do caminho (motion#636), deixando o cartão parado onde o dedo largou.
          void animate(x, 0, { type: "spring", stiffness: 500, damping: 40 }).then(() => {
            if (action === "complete") onComplete();
            else if (action === "delete") onDelete();
          });
        }}
        aria-label={`${copy.task.complete} / ${copy.task.delete}`}
        className="flex touch-pan-y"
      >
        {/* `-ml-[100%]` é o que põe este painel FORA, à esquerda: sem ele a fileira começaria nele
            e o cartão ficaria uma tela adiante. O ícone fica na borda que encosta no cartão, então
            aparece já no primeiro centímetro do gesto. */}
        <div
          aria-hidden
          className={cn(
            panelClass,
            "-ml-[100%] justify-end pr-4 text-success",
            armed === "complete" ? "bg-success/30" : "bg-success/15",
          )}
        >
          <CheckIcon
            className={cn("size-5 transition-transform", armed === "complete" && "scale-125")}
          />
        </div>

        <div className="w-full shrink-0">{children}</div>

        <div
          aria-hidden
          className={cn(
            panelClass,
            "pl-4 text-destructive",
            armed === "delete" ? "bg-destructive/30" : "bg-destructive/15",
          )}
        >
          <Trash2Icon
            className={cn("size-5 transition-transform", armed === "delete" && "scale-125")}
          />
        </div>
      </motion.div>
    </div>
  );
}

/** Empurrão rápido: vale pela velocidade, desde que o dedo tenha saído do lugar. */
function flick(offset: number, velocity: number): Armed {
  if (Math.abs(velocity) < FLICK_VELOCITY || Math.abs(offset) < FLICK_MIN) return null;
  return velocity > 0 ? "complete" : "delete";
}
