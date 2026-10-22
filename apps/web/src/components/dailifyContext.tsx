import { InvoicesProps, PaymentDetailsProps, TaskProps } from "@/types/types";
import { createContext, useContext, useState, ReactNode } from "react";
import { DEFAULT_WEEK_START } from "@dailify/shared";
import type { QuotaKey, WeekStart } from "@dailify/shared";
import type { QuotaSnapshot } from "@/functions/api";

interface DailifyContextType {
  selectedDay: Date;
  setSelectedDay: (selectedDay: Date) => void;
  tasks: TaskProps[] | undefined;
  setTasks: (task: TaskProps[]) => void;
  isLoading: string | null;
  setIsLoading: (isLoading: string | null) => void;
  currentMonth?: Date;
  setCurrentMonth: (currentMonth: Date) => void;
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
  const [tasks, setTasks] = useState<TaskProps[]>();
  const [isLoading, setIsLoading] = useState<null | string>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>();
  const [currentMonthTasks, setCurrentMonthTasks] = useState<TaskProps[]>();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsProps | null>();
  const [quotas, setQuotas] = useState<QuotaSnapshot>();
  const [invoices, setInvoices] = useState<InvoicesProps[]>();

  const [undatedTasks, setUndatedTasks] = useState<TaskProps[]>();
  const [weekStart, setWeekStart] = useState<WeekStart>(DEFAULT_WEEK_START);

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
        tasks,
        setTasks,
        isLoading,
        setIsLoading,
        currentMonth,
        setCurrentMonth,
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
