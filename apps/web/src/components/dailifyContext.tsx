import { InvoicesProps, PaymentDetailsProps, TaskProps } from "@/types/types";
import { createContext, useContext, useRef, useState, ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { isSameMonth, startOfDay, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { DEFAULT_WEEK_START } from "@dailify/shared";
import type { QuotaKey, WeekStart } from "@dailify/shared";
import { getTasksForMonth } from "@/functions/api";
import type { ApiError, QuotaSnapshot } from "@/functions/api";
import { initialMonths, mergeMonth, monthsBetween } from "@/functions/functions";
import { copy } from "@/components/dashboard/copy";

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
  currentMonthTasks: TaskProps[] | undefined;
  setCurrentMonthTasks: (task: TaskProps[]) => void;
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
  /** Incremento otimista: sem ele a barra só se moveria no próximo fetch. */
  bumpUsage: (key: QuotaKey) => void;
}

// Criando o contexto com um valor inicial `undefined`
const DailifyContext = createContext<DailifyContextType | undefined>(undefined);

// Criando o provider
export function DailifyProvider({ children }: { children: ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [targetDay, setTargetDay] = useState<Date>();
  const [tasks, setTasks] = useState<TaskProps[]>();
  const [isLoading, setIsLoading] = useState<null | string>(null);
  // Já começa com os do boot: com o cache na tela antes da 1ª leitura, `[]` apagava as instâncias.
  const [loadedMonths, setLoadedMonths] = useState<Date[]>(() => initialMonths(new Date()));
  const [currentMonthTasks, setCurrentMonthTasks] = useState<TaskProps[]>();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsProps | null>();
  const [quotas, setQuotas] = useState<QuotaSnapshot>();
  const [invoices, setInvoices] = useState<InvoicesProps[]>();

  const [undatedTasks, setUndatedTasks] = useState<TaskProps[]>();
  const [weekStart, setWeekStart] = useState<WeekStart>(DEFAULT_WEEK_START);

  const { getToken } = useAuth();
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
        const token = await getToken();
        if (!token) {
          forget();
          return;
        }
        const { tasks: fetched, error } = await getTasksForMonth(token, month);
        if (error) {
          forget();
          return error;
        }
        // Uma releitura mais nova do mesmo mês já está no mapa: esta resposta é velha.
        if (!isCurrent()) return;
        if (isSameMonth(new Date(), month)) setCurrentMonthTasks(fetched);
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
    const errors = await Promise.all(keys.map((key) => fetchMonth(new Date(key))));
    const error = errors.find(Boolean);
    // O cache traz meses que ninguém rebusca e ficariam velhos pra sempre; só poda com tudo em mãos.
    if (!error && keys.every((key) => monthRequests.current.has(key))) {
      setTasks((prev) =>
        prev?.filter((t) => monthRequests.current.has(startOfMonth(t.date).getTime())),
      );
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
        toast.error(copy.loading.tasksError, { description: error.message });
      }
    } catch {
      toast.error(copy.loading.tasksError);
    }
  };

  const goToDay = async (day: Date) => {
    const today = startOfDay(new Date());
    setSelectedDay(day);
    // Dia passado vira o início da lista; o futuro precisa dos meses do meio, senão a lista não o alcança.
    await Promise.all(monthsBetween(day < today ? day : today, day).map(loadMonth));
    // Data nova a cada clique: clicar no mesmo dia de novo rola de novo.
    setTargetDay(new Date(day));
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
        currentMonthTasks,
        setCurrentMonthTasks,
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
