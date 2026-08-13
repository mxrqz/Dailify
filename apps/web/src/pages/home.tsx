import { useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";

import { DayList } from "@/components/dashboard/day-list";
import { DaySummary } from "@/components/dashboard/day-summary";
import { TaskComposer } from "@/components/dashboard/task-composer";

/** Altura viva de um elemento: CSS não enxerga a altura do irmão, e aqui duas posições dependem. */
function useHeight(ref: RefObject<HTMLElement>): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => setHeight(element.offsetHeight);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}

const SUMMARY_TOP = 24; // top-6
const SUMMARY_GAP = 24; // respiro entre o resumo e o composer

/**
 * O dashboard. O resumo fica fora do fluxo pra não deslocar o composer, que é empurrado até o
 * centro da viewport pela margem — assim a lista vem 40px depois DELE, não depois da dobra.
 * 2.5rem = a top bar (h-10).
 *
 * O piso do `max()` existe justamente porque "fora do fluxo" quer dizer que ninguém reserva
 * espaço pro resumo: sem ele, em tela baixa o composer sobe por cima do calendário.
 */
export default function Home() {
  const summaryRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const summaryHeight = useHeight(summaryRef);
  const composerHeight = useHeight(composerRef);

  const centered = `calc(50dvh - 2.5rem - ${composerHeight / 2}px)`;
  const belowSummary = `${SUMMARY_TOP + summaryHeight + SUMMARY_GAP}px`;

  return (
    // `flow-root`: sem ele a margem do composer colapsa pra fora e empurra este container junto
    // — e o resumo, ancorado nele, desce junto, caindo em cima do composer.
    <div className="relative flow-root pb-10" id="main">
      <div ref={summaryRef} className="absolute inset-x-0 top-6">
        <DaySummary />
      </div>

      <div ref={composerRef} style={{ marginTop: `max(${centered}, ${belowSummary})` }}>
        {/* ponytail: onSubmit só ecoa o que foi digitado — interpretar "terça às 10" exige a IA
            do Pro+AI, que ainda não existe neste caminho. */}
        <TaskComposer
          onSubmit={(values) =>
            toast.message(values.text, { description: values.date?.toString() ?? values.when })
          }
        />
      </div>

      <div className="mt-10">
        <DayList />
      </div>
    </div>
  );
}
