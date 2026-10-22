import { useEffect, useState } from "react";

import { DayList } from "@/components/dashboard/day-list";
import { MobilePager } from "@/components/dashboard/mobile-pager";
import { UndatedList } from "@/components/dashboard/undated-list";
import { UndatedColumn, useUndatedOpen } from "@/components/dashboard/undated-column";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { TaskComposer, type ComposerValues } from "@/components/dashboard/task-composer";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Altura viva de um elemento: CSS não enxerga a altura do irmão, e o piso do slot depende da faixa.
 * Ref de callback porque a faixa remonta ao cruzar o `md` (entra e sai do pager).
 */
function useHeight(): [(element: HTMLElement | null) => void, number] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!element) return;

    const update = () => setHeight(element.offsetHeight);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, height];
}

const STRIP_TOP = 24; // top-6
const STRIP_GAP = 24; // respiro entre a faixa e o composer

// Composer fechado (p-1 + min-h-19 do campo + as duas bordas) e o quanto o eco acrescenta quando
// abre (gap-1 + p-2 + a linha de chips). Constantes, não medidas: com a altura viva o rodapé
// perseguia a animação e a lista inteira balançava a cada frame do ResizeObserver.
const COMPOSER_HEIGHT = 86;
const ECHO_HEIGHT = 42;

/**
 * O dashboard. A faixa fica fora do fluxo pra não deslocar o composer, que fica no rodapé de um
 * slot de altura fixa terminando no centro da viewport — assim a lista vem 40px depois DELE, não
 * depois da dobra. 2.5rem = a top bar (h-10); no md+ soma o p-1 do shell.
 *
 * O piso do `max()` existe justamente porque "fora do fluxo" quer dizer que ninguém reserva
 * espaço pra faixa: sem ele, em tela baixa o composer sobe por cima dela.
 */
export default function Home() {
  const { create, submitting } = useCreateTask();

  const [stripRef, stripHeight] = useHeight();

  // Alturas do SLOT, não do composer: ele termina meia altura de composer abaixo do centro da tela,
  // que é onde o rodapé dele fica cravado. O piso soma o eco pra que abrir pra cima em tela baixa
  // não invada a faixa.
  const desktop = useMediaQuery("(min-width: 768px)");
  const centered = `calc(50dvh - ${desktop ? "2.75rem" : "2.5rem"} + ${COMPOSER_HEIGHT / 2}px)`;
  const belowStrip = `${STRIP_TOP + stripHeight + STRIP_GAP + ECHO_HEIGHT + COMPOSER_HEIGHT}px`;

  const [undatedOpen, setUndatedOpen] = useUndatedOpen();
  const [page, setPage] = useState<0 | 1>(0);

  const handleCompose = ({ parsed, undatedOnly }: ComposerValues) =>
    void create(parsed, { undatedOnly });

  const agenda = (
    <div className="relative pb-10" id="main">
      <div ref={stripRef} className="absolute inset-x-0 top-6">
        <WeekStrip />
      </div>

      {/*
       * O slot tem altura fixa e o composer mora no rodapé dele: o eco abre pra dentro do vão
       * que já estava reservado acima, então nem o campo nem a lista sentem a animação. Eco
       * maior que o vão (chips em duas linhas numa tela curta) volta a empurrar — aí é subir o
       * `ECHO_HEIGHT`.
       */}
      <div
        className="flex flex-col justify-end"
        style={{ minHeight: `max(${centered}, ${belowStrip})` }}
      >
        <TaskComposer submitting={submitting} onSubmit={handleCompose} />
      </div>

      <div className="mt-10">
        <DayList />
      </div>
    </div>
  );

  return (
    // Shell (md+): fundo preto com a agenda e a coluna Sem data como painéis lado a lado.
    <div className="flex min-w-0 flex-1 md:bg-surface-shell md:p-1">
      <div className="relative min-w-0 flex-1 md:rounded-field md:bg-surface-card md:px-gutter">
        {desktop ? (
          agenda
        ) : (
          <MobilePager
            pages={[
              <div key="today" className="px-gutter">
                {agenda}
              </div>,
              <UndatedList key="undated" className="px-gutter py-4.5" />,
            ]}
            index={page}
            onIndexChange={setPage}
          />
        )}
      </div>

      <UndatedColumn open={undatedOpen} onOpenChange={setUndatedOpen} />
    </div>
  );
}
