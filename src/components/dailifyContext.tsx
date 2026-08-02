import { InvoicesProps, PaymentDetailsProps, PermissionsProps, TaskProps } from "@/types/types";
import { createContext, useContext, useState, ReactNode } from "react";

interface DailifyContextType {
  selectedDay: Date;
  setSelectedDay: (selectedDay: Date) => void;
  isCalendar: boolean;
  setIsCalendar: (isCalendar: boolean) => void;
  tasks: TaskProps[] | undefined;
  setTasks: (task: TaskProps[]) => void;
  isLoading: string | null;
  setIsLoading: (isLoading: string | null) => void;
  currentMonth?: Date;
  setCurrentMonth: (currentMonth: Date) => void;
  currentMonthTasks: TaskProps[] | undefined;
  setCurrentMonthTasks: (task: TaskProps[]) => void;
  paymentDetails: PaymentDetailsProps | undefined;
  setPaymentDetails: (paymentDetails: PaymentDetailsProps) => void;
  invoices: InvoicesProps[] | undefined;
  setInvoices: (invoices: InvoicesProps[]) => void;
  permissions: PermissionsProps | undefined;
  setPermissions: (permissions: PermissionsProps) => void;
}

// Criando o contexto com um valor inicial `undefined`
const DailifyContext = createContext<DailifyContextType | undefined>(undefined);

// Criando o provider
export function DailifyProvider({ children }: { children: ReactNode }) {
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [isCalendar, setIsCalendar] = useState<boolean>(false);
  const [tasks, setTasks] = useState<TaskProps[]>();
  const [isLoading, setIsLoading] = useState<null | string>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>();
  const [currentMonthTasks, setCurrentMonthTasks] = useState<TaskProps[]>();
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsProps>();
  const [permissions, setPermissions] = useState<PermissionsProps>();
  const [invoices, setInvoices] = useState<InvoicesProps[]>();

  return (
    <DailifyContext.Provider
      value={{
        selectedDay,
        setSelectedDay,
        isCalendar,
        setIsCalendar,
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
        permissions,
        setPermissions,
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
