import { ReactNode, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2Icon } from "lucide-react";
import { useDailify } from "./dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { getTasksForMonth, getPermissions, getPaymentDetails, getInvoices } from "@/functions/api";
import { isSameMonth } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const {
    tasks,
    selectedDay,
    setTasks,
    setIsLoading,
    isLoading,
    setCurrentMonth,
    currentMonth,
    setCurrentMonthTasks,
    setInvoices,
    setPaymentDetails,
    setPermissions,
  } = useDailify();

  const location = useLocation();
  const { getToken, userId } = useAuth();

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;

      setPaymentDetails(await getPaymentDetails(token));
      setPermissions(await getPermissions(token));
      setInvoices(await getInvoices(token));
    })();
  }, []);

  // 🌐 Salvar timezone no metadata do usuário
  useEffect(() => {
    if (!user) return;
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const savedTimezone = user.unsafeMetadata?.timezone;

    if (!savedTimezone) {
      user.update({
        unsafeMetadata: { timezone: currentTimezone },
      });
    }
  }, [user]);

  // 📅 Função principal para carregar as tasks
  const getTasks = useCallback(async () => {
    if (!userId || !user) return;

    setIsLoading(copy.loading.tasks);
    try {
      const token = await getToken();
      if (!token) return;

      const tasks = await getTasksForMonth(token, selectedDay);

      if (isSameMonth(new Date(), selectedDay)) {
        setCurrentMonthTasks(tasks);
      }

      setTasks(tasks);
    } catch {
      // Sem isto o app trava no spinner para sempre: a exceção pulava o `setIsLoading(null)` e o
      // gate lá embaixo (`isLoading && !tasks`) nunca liberava. `setTasks([])` é o que destrava —
      // a tela então mostra o estado vazio, que é honesto, em vez de um "carregando" eterno.
      setTasks([]);
      toast.error(copy.loading.tasksError);
    } finally {
      setIsLoading(null);
    }
  }, [userId, user, selectedDay]);

  // 🗓️ Atualizar tarefas se mudar de mês (também cobre a carga inicial, já que currentMonth começa undefined)
  useEffect(() => {
    if (!isLoaded || !userId) return;

    const shouldUpdateMonth = !currentMonth || !isSameMonth(currentMonth, selectedDay);
    if (shouldUpdateMonth) {
      setCurrentMonth(selectedDay);
      getTasks();
    }
  }, [selectedDay, isLoaded, userId]);

  // 🧭 Redirecionar se não estiver logado
  if (!isLoaded || (isLoading && !tasks)) {
    return (
      <div className="w-full h-dvh flex flex-col items-center justify-center gap-5 bg-background">
        <Loader2Icon className="size-12 text-foreground animate-spin" />
        <motion.span
          key={isLoading}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.3 }}
          className="text-lg text-muted-foreground font-medium"
        >
          {isLoading}
        </motion.span>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
