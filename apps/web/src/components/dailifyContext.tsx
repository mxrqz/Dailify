import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Dispatch, SetStateAction } from "react";
import { startOfDay } from "date-fns";
import { toast } from "sonner";
import { DEFAULT_WEEK_START } from "@dailify/shared";
import type {
  Invoice,
  PaymentDetails,
  QuotaKey,
  QuotaSnapshot,
  Task,
  WeekStart,
} from "@dailify/shared";
import type { ApiError } from "@/functions/api";
import { monthsBetween } from "@/functions/functions";
import {
  loadTaskMonth,
  rezoneTasks,
  setDated,
  setUndated,
  subscribeTasks,
  tasksSnapshot,
} from "@/functions/task-store";
import { copy } from "@/components/dashboard/copy";
import { appTimeZone, setAppTimeZone, zoned } from "@/functions/zone";

interface DailifyContextType {
  selectedDay: Date;
  /** Dia pedido por clique; a lista rola até ele e o mostra mesmo sem tarefa. */
  targetDay: Date | undefined;
  /** Carrega os meses até o dia e só então o marca como alvo, pra ele já estar na lista. */
  goToDay: (day: Date) => Promise<void>;
  tasks: Task[] | undefined;
  /** Functional form after an await or from an Undo: a snapshot reverts writes that landed since. */
  setTasks: Dispatch<SetStateAction<Task[] | undefined>>;
  /** The boot's task load is in flight. */
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  /** Inícios dos meses na tela, em ordem; quem reconstrói recorrência expande neles. */
  loadedMonths: Date[];
  /** Shows the month: local inside the synced window, fetched once before it. */
  loadMonth: (month: Date) => Promise<void>;
  paymentDetails: PaymentDetails | null | undefined;
  setPaymentDetails: (paymentDetails: PaymentDetails | null) => void;
  invoices: Invoice[] | undefined;
  setInvoices: (invoices: Invoice[]) => void;
  quotas: QuotaSnapshot | undefined;
  setQuotas: (quotas: QuotaSnapshot) => void;
  undatedTasks: Task[] | undefined;
  setUndatedTasks: Dispatch<SetStateAction<Task[] | undefined>>;
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

/** A failed load is not an empty month; offline with an agenda on screen stays silent (the indicator tells). */
export function reportLoadError(error: ApiError | undefined, hasTasks: boolean): void {
  if (error?.offline && hasTasks) return;
  toast.error(copy.loading.tasksError, { id: "tasks-load-error", description: error?.message });
}

const DailifyContext = createContext<DailifyContextType | undefined>(undefined);

export function DailifyProvider({ children }: { children: ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<Date>(() => zoned());
  const [targetDay, setTargetDay] = useState<Date>();
  const {
    dated: tasks,
    undated: undatedTasks,
    months: loadedMonths,
  } = useSyncExternalStore(subscribeTasks, tasksSnapshot);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>();
  const [quotas, setQuotas] = useState<QuotaSnapshot>();
  const [invoices, setInvoices] = useState<Invoice[]>();

  const [weekStart, setWeekStart] = useState<WeekStart>(DEFAULT_WEEK_START);
  const [timeZone, setTimeZoneState] = useState<string | null>(null);
  const [hour12, setHour12] = useState(false);

  const loadMonth = async (month: Date) => {
    const error = await loadTaskMonth(month);
    // Offline com agenda na tela, cada mês pedido viraria um toast.
    if (error) reportLoadError(error, Boolean(tasksSnapshot().dated?.length));
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
    setSelectedDay((day) => zoned(day));
    rezoneTasks();
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
        targetDay,
        goToDay,
        tasks,
        setTasks: setDated,
        isLoading,
        setIsLoading,
        loadedMonths,
        loadMonth,
        invoices,
        setInvoices,
        paymentDetails,
        setPaymentDetails,
        quotas,
        setQuotas,
        undatedTasks,
        setUndatedTasks: setUndated,
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

export function useDailify() {
  const context = useContext(DailifyContext);
  if (!context) throw new Error("useDailify must be used within DailifyProvider");
  return context;
}
