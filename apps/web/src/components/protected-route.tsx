import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { reportLoadError, useDailify } from "./dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { getQuotas, getSettings } from "@/functions/api";
import { flushQueue, rememberUser } from "@/functions/offline";
import { openTasks, pullTasks, tasksSnapshot } from "@/functions/task-store";
import { fill } from "@/functions/functions";
import { useNow } from "@/hooks/useNow";
import { useUser } from "@/hooks/useUser";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { AnimatePresence } from "motion/react";
import { Splash, SPLASH_MIN_MS } from "@/components/splash";
import { toast } from "sonner";
import { useSession } from "@/lib/auth";
import { refreshReminders } from "@/lib/reminders";

/** Piso entre revalidações: alternar de aba não pode virar rajada de fetch. */
const REVALIDATE_AFTER_MS = 30_000;

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = useSession();
  const isLoaded = !session.isPending;
  const user = session.data?.user;
  // Rede ou 5xx no get-session não é sair: segue com quem estava logado e pinta o cache. Só um
  // 401 (ou resposta sem sessão) manda pro /login.
  const userId = useUser()?.id;
  const {
    tasks,
    setTasks,
    setIsLoading,
    isLoading,
    setQuotas,
    setUndatedTasks,
    setWeekStart,
    setTimeZone,
    setHour12,
  } = useDailify();

  const location = useLocation();

  useEffect(() => {
    if (user) rememberUser(user);
  }, [user]);

  // Preferências valem para a conta toda; as tarefas vêm do pull.
  const loadSettings = async () => {
    const { settings } = await getSettings();
    if (!settings) return;
    setWeekStart(settings.weekStart);
    setTimeZone(settings.timeZone);
    setHour12(settings.hour12);
  };

  // Its own effect because the AI credits reset with TODAY's month; the other data doesn't.
  // `quotas` fica undefined se a API falhou — `computeQuotas` trata isso como "ainda carregando",
  // que é o comportamento seguro: a UI se esconde e a criação não é bloqueada.
  // Also rereads on `quotaNonce`, which the revalidation below bumps: `bumpUsage` only counts up.
  const now = useNow("day");
  const quotaYear = now.getFullYear();
  const quotaMonth = now.getMonth();
  const [quotaNonce, setQuotaNonce] = useState(0);
  useEffect(() => {
    if (!isLoaded || !userId) return;
    // Virada de mês ou releitura com fetch em voo: a resposta anterior não vale mais.
    let current = true;
    void getQuotas().then(({ quotas }) => {
      if (current && quotas) setQuotas(quotas);
    });
    return () => {
      current = false;
    };
  }, [isLoaded, userId, setQuotas, quotaYear, quotaMonth, quotaNonce]);

  useEffect(() => {
    const onHidden = () => {
      // Leaving the app is when its alarms must match the server: the worker runs only hourly.
      if (document.visibilityState === "hidden") refreshReminders();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, []);

  // Paint what IndexedDB holds before touching the network (opening offline still shows the
  // agenda), then send the outbox, then pull: read before the queue, the server would hand back
  // the old state and the screen would step back for a moment.
  const getTasks = useEffectEvent(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      await openTasks(userId);
      const { dropped } = await flushQueue(userId);
      // Descartada = o servidor recusou (quota, tarefa que já não existe). A tarefa vai sumir da
      // tela no pull logo abaixo, e sumir sem explicação parece perda de dado.
      if (dropped) toast.error(fill(copy.sync.dropped, { n: dropped }));
      void loadSettings();
      const error = await pullTasks();
      if (error) reportLoadError(error, Boolean(tasksSnapshot().dated?.length));
    } catch {
      reportLoadError(undefined, false);
    } finally {
      // Without a cache or a pull the lists stay undefined and the splash would hold forever.
      setTasks((cur) => cur ?? []);
      setUndatedTasks((cur) => cur ?? []);
      setIsLoading(false);
    }
  });

  // Once per user: an account switch opens the other user's store, which drops the previous lists.
  const booted = useRef<string>();
  useEffect(() => {
    if (!isLoaded || !userId || booted.current === userId) return;
    booted.current = userId;
    void getTasks();
  }, [isLoaded, userId]);

  // O celular passa horas em segundo plano e volta com a lista de antes; tarefa criada no desktop
  // não aparecia. Sobe a fila e puxa ao voltar pra aba e ao reconectar, com um piso de tempo pra
  // alternar de aba não virar rajada de fetch.
  const lastFetch = useRef(Date.now());
  useEffect(() => {
    if (!isLoaded || !userId) return;

    const revalidate = (force = false) => {
      if (document.visibilityState !== "visible") return;
      if (!force && Date.now() - lastFetch.current < REVALIDATE_AFTER_MS) return;
      lastFetch.current = Date.now();
      void getTasks();
      setQuotaNonce((n) => n + 1);
    };

    const onVisible = () => revalidate();
    // Reconectar ignora o piso: é o momento exato em que a fila tem que subir.
    const onOnline = () => revalidate(true);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [isLoaded, userId]);

  // O splash sai assim que os dados chegam, mas não antes do pulinho de entrada da Mew (senão
  // pisca). Só quem montou carregando segura: trocar de rota com tudo em mãos não ganha splash.
  const loading = !isLoaded || (isLoading && !tasks);
  const [held, setHeld] = useState(loading);
  useEffect(() => {
    if (!held) return;
    const id = setTimeout(() => setHeld(false), SPLASH_MIN_MS);
    return () => clearTimeout(id);
  }, [held]);
  const splash = loading || held;

  if (!loading && !userId) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <>
      {!splash && children}
      <AnimatePresence>{splash && <Splash key="splash" />}</AnimatePresence>
    </>
  );
}
