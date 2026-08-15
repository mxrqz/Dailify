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
import type { ParsedWhen } from "@/functions/parse-task";
import { useEntitlements } from "@/hooks/useEntitlements";

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

const STRIP_TOP = 24; // top-6
const STRIP_GAP = 24; // respiro entre a faixa e o composer

const DEFAULT_HOUR = 9; // "amanhã" sem horário cai no começo do dia útil
const DEFAULT_DURATION = "10m";

/** O composer só pergunta quando e o quê; o resto do `TaskInput` vem daqui. */
function composerTaskInput(text: string, parsed: ParsedWhen | null): TaskInput {
  // Cópia: `parsed.date` é do estado do composer, e mutar aqui mexeria no eco que ele mostra.
  const date = parsed ? new Date(parsed.date) : new Date();
  if (parsed && !parsed.hasTime) date.setHours(DEFAULT_HOUR, 0, 0, 0);

  return {
    title: text,
    description: "",
    date: date.getTime(),
    duration: DEFAULT_DURATION,
    priority: 0,
    repeat: "Off",
  };
}

/**
 * O dashboard. A faixa fica fora do fluxo pra não deslocar o composer, que é empurrado até o
 * centro da viewport pela margem — assim a lista vem 40px depois DELE, não depois da dobra.
 * 2.5rem = a top bar (h-10).
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
  const composerRef = useRef<HTMLDivElement>(null);
  const stripHeight = useHeight(stripRef);
  const composerHeight = useHeight(composerRef);

  const centered = `calc(50dvh - 2.5rem - ${composerHeight / 2}px)`;
  const belowStrip = `${STRIP_TOP + stripHeight + STRIP_GAP}px`;

  const handleCompose = async ({ when, parsed, text }: ComposerValues) => {
    if (!canCreateTask) {
      toast(copy.form.limitReached, {
        description: copy.form.limitReachedHint,
        action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
      });
      return;
    }

    // Campo vazio vira "agora"; campo escrito que o parser não entendeu é erro — criar numa data
    // adivinhada seria pior do que não criar.
    if (when && !parsed) {
      toast.warning(copy.composer.notUnderstood);
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      setSubmitting(false);
      return;
    }

    const { task, error } = await createTask(token, composerTaskInput(text, parsed));
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
    // `flow-root`: sem ele a margem do composer colapsa pra fora e empurra este container junto
    // — e a faixa, ancorada nele, desce junto, caindo em cima do composer.
    <div className="relative flow-root pb-10" id="main">
      <div ref={stripRef} className="absolute inset-x-0 top-6">
        <WeekStrip />
      </div>

      <div ref={composerRef} style={{ marginTop: `max(${centered}, ${belowStrip})` }}>
        <TaskComposer submitting={submitting} onSubmit={handleCompose} />
      </div>

      <div className="mt-10">
        <DayList />
      </div>
    </div>
  );
}
