import { InvoicesProps, PaymentDetailsProps, TaskProps } from "@/types/types";
import { createContext, useContext, useRef, useState, ReactNode } from "react";
import { addDays, endOfMonth, startOfDay, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { DEFAULT_WEEK_START } from "@dailify/shared";
import type { QuotaKey, WeekStart } from "@dailify/shared";
import { getTasksForMonth } from "@/functions/api";
import type { ApiError, QuotaSnapshot } from "@/functions/api";
import { initialMonths, mergeMonth, monthsBetween } from "@/functions/functions";
import { copy } from "@/components/dashboard/copy";
import { appTimeZone, setAppTimeZone, zoned } from "@/functions/zone";

interface DailifyContextType {
  selectedDay: Date;
  setSelectedDay: (selectedDay: Date) => void;
  /** Dia pedido por clique; a lista rola até ele e o mostra mesmo sem tarefa. */
  targetDay: Date | undefined;
  /** Carrega os meses até o dia e só então o marca como alvo, pra ele já estar na lista. */
  goToDay: (day: Date) => Promise<void>;
  tasks: TaskProps[] | undefined;
  setTasks: (task: TaskProps[]) => void;
  isLoading: string | null;
  setIsLoading: (isLoading: string | null) => void;
  /** Inícios dos meses na tela, em ordem; quem reconstrói recorrência expande neles. */
  loadedMonths: Date[];
  /** Busca e mescla o mês; já carregado ou em voo não refaz. */
  loadMonth: (month: Date) => Promise<void>;
  /** Rebusca os meses à força (boot, volta do segundo plano); devolve o primeiro erro. */
  reloadMonths: (months: Date[]) => Promise<ApiError | undefined>;
  paymentDetails: PaymentDetailsProps | null | undefined;
  setPaymentDetails: (paymentDetails: PaymentDetailsProps | null) => void;
  invoices: InvoicesProps[] | undefined;
  setInvoices: (invoices: InvoicesProps[]) => void;
  quotas: QuotaSnapshot | undefined;
  setQuotas: (quotas: QuotaSnapshot) => void;
  undatedTasks: TaskProps[] | undefined;
  setUndatedTasks: (tasks: TaskProps[]) => void;
  weekStart: WeekStart;
  setWeekStart: (weekStart: WeekStart) => void;
  /** Fuso escolhido em /settings; null = automático (o do aparelho). */
  timeZone: string | null;
  setTimeZone: (timeZone: string | null) => void;
  hour12: boolean;
  setHour12: (hour12: boolean) => void;
  /** Incremento otimista: sem ele a barra só se moveria no próximo fetch. */
  bumpUsage: (key: QuotaKey) => void;
}

// Criando o contexto com um valor inicial `undefined`
const DailifyContext = createContext<DailifyContextType | undefined>(undefined);

// Criando o provider
export function DailifyProvider({ children }: { children: ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<Date>(() => zoned());
  const [targetDay, setTargetDay] = useState<Date>();
  const [tasks, setTasks] = useState<TaskProps[]>();
  const [isLoading, setIsLoading] = useState<null | string>(null);
  // Já começa com os do boot: com o cache na tela antes da 1ª leitura, `[]` apagava as instâncias.
  const [loadedMonths, setLoadedMonths] = useState<Date[]>(() => initialMonths(zoned()));
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsProps | null>();
  const [quotas, setQuotas] = useState<QuotaSnapshot>();
  const [invoices, setInvoices] = useState<InvoicesProps[]>();

  const [undatedTasks, setUndatedTasks] = useState<TaskProps[]>();
  const [weekStart, setWeekStart] = useState<WeekStart>(DEFAULT_WEEK_START);
  const [timeZone, setTimeZoneState] = useState<string | null>(null);
  const [hour12, setHour12] = useState(false);

  // Mês carregado ou em voo, pela chave do início do mês; falha sai daqui pra poder tentar de novo.
  const monthRequests = useRef(new Map<number, Promise<ApiError | undefined>>());

  const fetchMonth = (date: Date): Promise<ApiError | undefined> => {
    const month = startOfMonth(date);
    const key = month.getTime();
    // Um refresh pode ter posto outra requisição no lugar; só esquece a própria.
    const isCurrent = () => monthRequests.current.get(key) === request;
    const forget = () => {
      if (isCurrent()) monthRequests.current.delete(key);
    };
    const request = (async (): Promise<ApiError | undefined> => {
      try {
        const { tasks: fetched, error } = await getTasksForMonth(month);
        if (error) {
          forget();
          return error;
        }
        // Uma releitura mais nova do mesmo mês já está no mapa: esta resposta é velha.
        if (!isCurrent()) return;
        setTasks((prev) => mergeMonth(prev ?? [], month, fetched));
        setLoadedMonths((prev) =>
          prev.some((m) => m.getTime() === key)
            ? prev
            : [...prev, month].sort((a, b) => a.getTime() - b.getTime()),
        );
      } catch (e) {
        forget();
        throw e;
      }
    })();
    monthRequests.current.set(key, request);
    return request;
  };

  const reloadMonths = async (months: Date[]) => {
    const keys = [...new Set(months.map((m) => startOfMonth(m).getTime()))];
    const errors = await Promise.all(keys.map((key) => fetchMonth(zoned(key))));
    const error = errors.find(Boolean);
    // O cache traz meses que ninguém rebusca e ficariam velhos pra sempre; só poda com tudo em mãos.
    if (!error && keys.every((key) => monthRequests.current.has(key))) {
      setTasks((prev) => {
        const months = [...monthRequests.current.keys()].map((key) => [
          key,
          +endOfMonth(zoned(key)),
        ]);
        return prev?.filter((t) => months.some(([from, to]) => t.date >= from && t.date <= to));
      });
    }
    return error;
  };

  const loadMonth = async (month: Date) => {
    const pending = monthRequests.current.get(startOfMonth(month).getTime());
    // Quem pediu primeiro avisa do erro; aqui só espera, pra o `await` valer como "carregou".
    if (pending) {
      await pending.catch(() => undefined);
      return;
    }
    try {
      const error = await fetchMonth(month);
      // Mesma regra do boot: offline com agenda na tela é silencioso, o indicador já conta.
      if (error && (!error.offline || !tasks?.length)) {
        toast.error(copy.loading.tasksError, {
          id: "tasks-load-error",
          description: error.message,
        });
      }
    } catch {
      // Offline com agenda na tela, cada mês pedido viraria um toast.
      if (navigator.onLine === false && tasks?.length) return;
      toast.error(copy.loading.tasksError, { id: "tasks-load-error" });
    }
  };

  const goToDay = async (day: Date) => {
    const today = startOfDay(zoned());
    // Todos os meses entre hoje e o dia: a lista só vai até o primeiro buraco, passado ou futuro.
    const [from, to] = day < today ? [day, today] : [today, day];
    await Promise.all(monthsBetween(from, to).map(loadMonth));
    // Só depois de carregar, pra a lista não trocar de início antes de ter os meses.
    setSelectedDay(day);
    // Data nova a cada clique: clicar no mesmo dia de novo rola de novo.
    setTargetDay(zoned(day));
  };

  const setTimeZone = (next: string | null) => {
    const before = appTimeZone();
    setAppTimeZone(next);
    setTimeZoneState(next);
    if (appTimeZone() === before) return;
    // Dia e mês mudam de fronteira com o fuso: tudo é relido nas janelas novas. O meio do mês
    // (+14d) ainda cai no mesmo mês em qualquer fuso; o início dele, não.
    const months = loadedMonths.map((m) => zoned(addDays(m, 14)));
    monthRequests.current.clear();
    setSelectedDay((day) => zoned(day));
    setLoadedMonths([]);
    void reloadMonths(months);
  };

  const bumpUsage = (key: QuotaKey) =>
    setQuotas((current) =>
      current
        ? { ...current, usage: { ...current.usage, [key]: current.usage[key] + 1 } }
        : current,
    );

  return (
    <DailifyContext.Provider
      value={{
        selectedDay,
        setSelectedDay,
        targetDay,
        goToDay,
        tasks,
        setTasks,
        isLoading,
        setIsLoading,
        loadedMonths,
        loadMonth,
        reloadMonths,
        invoices,
        setInvoices,
        paymentDetails,
        setPaymentDetails,
        quotas,
        setQuotas,
        undatedTasks,
        setUndatedTasks,
        weekStart,
        setWeekStart,
        timeZone,
        setTimeZone,
        hour12,
        setHour12,
        bumpUsage,
      }}
    >
      {children}
    </DailifyContext.Provider>
  );
}

// Hook para usar o contexto
export function useDailify() {
  const context = useContext(DailifyContext);
  if (!context) throw new Error("useDailify must be used within a ThemeProvider");
  return context;
}
