import { ReactNode, useEffect, useCallback, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2Icon } from "lucide-react";
import { useDailify } from "./dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { getTasksForMonth, getPermissions, getPaymentDetails, getInvoices } from "@/functions/api";
import { cacheTasks, flushQueue, readCachedTasks } from "@/functions/offline";
import { isSameMonth } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";

/** Piso entre revalidações: alternar de aba não pode virar rajada de fetch. */
const REVALIDATE_AFTER_MS = 30_000;

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

  // Depende de `isLoaded`/`userId`: com deps `[]` o efeito rodava uma vez só, antes do Clerk ficar
  // pronto, e o `getToken()` nulo deixava `permissions` undefined pelo resto da sessão.
  useEffect(() => {
    if (!isLoaded || !userId) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // allSettled: uma falha não derruba as vizinhas.
        const [payment, permissions, invoices] = await Promise.allSettled([
          getPaymentDetails(token),
          getPermissions(token),
          getInvoices(token),
        ]);

        if (payment.status === "fulfilled") setPaymentDetails(payment.value);
        if (invoices.status === "fulfilled") setInvoices(invoices.value);
        // permissions fica undefined se a API falhou — `computeEntitlements` trata isso como
        // "ainda carregando", que é o comportamento seguro. Guardar o corpo do erro quebraria.
        if (permissions.status === "fulfilled" && permissions.value) {
          setPermissions(permissions.value);
        }
      } catch {
        /* sem sessão utilizável */
      }
    })();
  }, [isLoaded, userId]);

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

  // O boot pinta o que estava salvo antes de tocar na rede: sem isso, abrir sem conexão dá tela
  // vazia mesmo com a agenda inteira em mãos.
  useEffect(() => {
    if (!userId || tasks) return;
    const cached = readCachedTasks(userId);
    if (cached?.length) {
      setTasks(cached);
      setIsLoading(null);
    }
  }, [userId]);

  // 📅 Função principal para carregar as tasks
  const getTasks = useCallback(async () => {
    if (!userId || !user) return;

    setIsLoading(copy.loading.tasks);
    try {
      const token = await getToken();
      if (!token) return;

      // A fila sobe ANTES da leitura: sem isso o servidor devolveria o estado velho e a tela
      // andaria pra trás por um instante.
      if (userId) await flushQueue(userId, token);

      const { tasks: fetched, error } = await getTasksForMonth(token, selectedDay);

      // Erro de carga não é mês vazio: sem o aviso, quem está sem rede lê "nada agendado" e acha
      // que perdeu as tarefas. Offline com cache na tela é silencioso — o indicador já conta.
      if (error) {
        if (!error.offline || !tasks?.length) {
          toast.error(copy.loading.tasksError, { description: error.message });
        }
        return;
      }

      if (isSameMonth(new Date(), selectedDay)) {
        setCurrentMonthTasks(fetched);
      }

      setTasks(fetched);
      if (userId) cacheTasks(userId, fetched);
    } catch {
      // Sem isto o app trava no spinner para sempre: a exceção pulava o `setIsLoading(null)` e o
      // gate lá embaixo (`isLoading && !tasks`) nunca liberava. `setTasks([])` é o que destrava —
      // a tela então mostra o estado vazio, que é honesto, em vez de um "carregando" eterno.
      setTasks([]);
      toast.error(copy.loading.tasksError);
    } finally {
      setIsLoading(null);
    }
  }, [userId, user, selectedDay, tasks]);

  // 🗓️ Atualizar tarefas se mudar de mês (também cobre a carga inicial, já que currentMonth começa undefined)
  useEffect(() => {
    if (!isLoaded || !userId) return;

    const shouldUpdateMonth = !currentMonth || !isSameMonth(currentMonth, selectedDay);
    if (shouldUpdateMonth) {
      setCurrentMonth(selectedDay);
      getTasks();
    }
  }, [selectedDay, isLoaded, userId]);

  // O celular passa horas em segundo plano e volta com a lista de antes; tarefa criada no desktop
  // não aparecia. Revalida ao voltar pra aba e ao reconectar, com um piso de tempo pra alternar
  // de aba não virar rajada de fetch.
  const lastFetch = useRef(Date.now());
  useEffect(() => {
    if (!isLoaded || !userId) return;

    const revalidate = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetch.current < REVALIDATE_AFTER_MS) return;
      lastFetch.current = Date.now();
      getTasks();
    };

    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("online", revalidate);
    return () => {
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("online", revalidate);
    };
  }, [isLoaded, userId, getTasks]);

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
