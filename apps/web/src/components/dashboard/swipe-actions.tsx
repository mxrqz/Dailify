import { useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useMotionValueEvent } from "framer-motion";
import { CheckIcon, Trash2Icon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { cn } from "@/lib/utils";

/**
 * Fração da LARGURA do cartão que o gesto precisa vencer pra ação valer — não um número de pixels:
 * um terço de um celular estreito e de um tablet são gestos igualmente deliberados, e excluir não
 * pode sair de um esbarrão. Abaixo disso o cartão volta e nada acontece.
 */
const THRESHOLD = 0.35;

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
    const distance = width.current * THRESHOLD;
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
        dragElastic={0.35}
        onDragStart={() => {
          width.current = track.current?.offsetWidth ?? 0;
        }}
        onDragEnd={() => {
          const action = armedRef.current;
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
