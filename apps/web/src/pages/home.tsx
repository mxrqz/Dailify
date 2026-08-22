import { useEffect, useRef, useState, type RefObject } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { TaskInput } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DayList } from "@/components/dashboard/day-list";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { TaskComposer, type ComposerValues } from "@/components/dashboard/task-composer";
import { createTask } from "@/functions/api";
import { upsertTaskById } from "@/functions/functions";
import type { ParsedTask } from "@/functions/parse-task";
import { useEntitlements } from "@/hooks/useEntitlements";

/** Altura viva de um elemento: CSS não enxerga a altura do irmão, e o piso do slot depende da faixa. */
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

const STRIP_TOP = 24; // top-6
const STRIP_GAP = 24; // respiro entre a faixa e o composer

// Composer fechado (p-1 + min-h-19 do campo + as duas bordas) e o quanto o eco acrescenta quando
// abre (gap-1 + p-2 + a linha de chips). Constantes, não medidas: com a altura viva o rodapé
// perseguia a animação e a lista inteira balançava a cada frame do ResizeObserver.
const COMPOSER_HEIGHT = 86;
const ECHO_HEIGHT = 42;

const DEFAULT_HOUR = 9; // data sem hora ("amanhã" puro) cai no começo do dia útil, não em 00:00
const DEFAULT_DURATION = "10m";

/** O composer entrega tudo já extraído; aqui só viram os campos que o `TaskInput` exige. */
function composerTaskInput(parsed: ParsedTask): TaskInput {
  // Cópia: `parsed.date` é o mesmo objeto que o composer usa pros chips — mutar mexeria no eco.
  const date = parsed.date ? new Date(parsed.date) : new Date();
  if (parsed.date && !parsed.hasTime) date.setHours(DEFAULT_HOUR, 0, 0, 0);

  return {
    title: parsed.text,
    date: date.getTime(),
    duration: parsed.duration ?? DEFAULT_DURATION,
    priority: 0,
    repeat: "Off",
    links: parsed.links.length ? parsed.links : undefined,
  };
}

/**
 * O dashboard. A faixa fica fora do fluxo pra não deslocar o composer, que fica no rodapé de um
 * slot de altura fixa terminando no centro da viewport — assim a lista vem 40px depois DELE, não
 * depois da dobra. 2.5rem = a top bar (h-10).
 *
 * O piso do `max()` existe justamente porque "fora do fluxo" quer dizer que ninguém reserva
 * espaço pra faixa: sem ele, em tela baixa o composer sobe por cima dela.
 */
export default function Home() {
  const { getToken } = useAuth();
  const { tasks, setTasks } = useDailify();
  const { canCreateTask } = useEntitlements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const stripHeight = useHeight(stripRef);

  // Alturas do SLOT, não do composer: ele termina meia altura de composer abaixo do centro da tela,
  // que é onde o rodapé dele fica cravado. O piso soma o eco pra que abrir pra cima em tela baixa
  // não invada a faixa.
  const centered = `calc(50dvh - 2.5rem + ${COMPOSER_HEIGHT / 2}px)`;
  const belowStrip = `${STRIP_TOP + stripHeight + STRIP_GAP + ECHO_HEIGHT + COMPOSER_HEIGHT}px`;

  const handleCompose = async ({ parsed }: ComposerValues) => {
    if (!canCreateTask) {
      toast(copy.form.limitReached, {
        description: copy.form.limitReachedHint,
        action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
      });
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      setSubmitting(false);
      return;
    }

    const { task, error } = await createTask(token, composerTaskInput(parsed));
    if (error || !task) {
      toast(copy.form.createError, {
        description: error,
        action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
      });
    } else {
      setTasks(upsertTaskById(tasks ?? [], task));
      toast.message(copy.form.created, { description: task.title });
    }

    setSubmitting(false);
  };

  return (
    <div className="relative pb-10" id="main">
      <div ref={stripRef} className="absolute inset-x-0 top-6">
        <WeekStrip />
      </div>

      {/*
       * O slot tem altura fixa e o composer mora no rodapé dele: o eco abre pra dentro do vão que
       * já estava reservado acima, então nem o campo nem a lista sentem a animação. Eco maior que o
       * vão (chips em duas linhas numa tela curta) volta a empurrar — aí é subir o `ECHO_HEIGHT`.
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
}
