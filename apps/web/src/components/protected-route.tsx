import { ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useDailify } from "./dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { getQuotas, getUndatedTasks, getSettings } from "@/functions/api";
import {
  cacheTasks,
  cacheUndated,
  flushQueue,
  readCachedTasks,
  readCachedUndated,
} from "@/functions/offline";
import { initialMonths } from "@/functions/functions";
import { useNow } from "@/hooks/useNow";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { AnimatePresence } from "motion/react";
import { Splash, SPLASH_MIN_MS } from "@/components/splash";
import { toast } from "sonner";
import { zoned, zonedAt } from "@/functions/zone";
import { useSession } from "@/lib/auth";

/** Piso entre revalidações: alternar de aba não pode virar rajada de fetch. */
const REVALIDATE_AFTER_MS = 30_000;
/** Cada `setTasks` serializava a agenda inteira na hora; agora só a última de uma rajada grava. */
const CACHE_AFTER_MS = 1_000;

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = useSession();
  const isLoaded = !session.isPending;
  const userId = session.data?.user.id;
  const {
    tasks,
    selectedDay,
    setTasks,
    setIsLoading,
    isLoading,
    loadedMonths,
    loadMonth,
    reloadMonths,
    setQuotas,
    undatedTasks,
    setUndatedTasks,
    setWeekStart,
    setTimeZone,
    setHour12,
  } = useDailify();

  const location = useLocation();

  // Sem dependência de mês: Sem data e preferências valem para a conta toda.
  const loadUndated = async () => {
    if (!userId) return;
    try {
      const [undated, settings] = await Promise.allSettled([getUndatedTasks(), getSettings()]);
      if (undated.status === "fulfilled" && !undated.value.error) {
        setUndatedTasks(undated.value.tasks);
      }
      const saved = settings.status === "fulfilled" ? settings.value.settings : undefined;
      if (saved) {
        setWeekStart(saved.weekStart);
        setTimeZone(saved.timeZone);
        setHour12(saved.hour12);
      }
    } catch {
      /* sem sessão utilizável */
    }
  };

  // Efeito próprio porque quota de escopo mensal vira com o mês de HOJE (não o do dia olhado: a
  // cota que bloqueia a criação é a do mês corrente); os outros dados, não.
  // `quotas` fica undefined se a API falhou — `computeQuotas` trata isso como "ainda carregando",
  // que é o comportamento seguro: a UI se esconde e a criação não é bloqueada.
  // Relê também no `quotaNonce`, que a revalidação lá embaixo incrementa: `bumpUsage` só sobe,
  // então sem uma releitura quem cria 30 tarefas e apaga 20 fica travado no 30 a sessão inteira.
  const now = useNow("day");
  const quotaYear = now.getFullYear();
  const quotaMonth = now.getMonth();
  const [quotaNonce, setQuotaNonce] = useState(0);
  useEffect(() => {
    if (!isLoaded || !userId) return;
    // Virada de mês ou releitura com fetch em voo: a resposta anterior não vale mais.
    let current = true;
    (async () => {
      try {
        const snapshot = await getQuotas(zonedAt(quotaYear, quotaMonth));
        if (current && snapshot) setQuotas(snapshot);
      } catch {
        /* sem sessão utilizável */
      }
    })();
    return () => {
      current = false;
    };
  }, [isLoaded, userId, setQuotas, quotaYear, quotaMonth, quotaNonce]);

  // O boot pinta o que estava salvo antes de tocar na rede: sem isso, abrir sem conexão dá tela
  // vazia mesmo com a agenda inteira em mãos.
  useEffect(() => {
    if (!userId || undatedTasks) return;
    const cached = readCachedUndated(userId);
    if (cached) setUndatedTasks(cached);
  }, [userId, undatedTasks, setUndatedTasks]);

  useEffect(() => {
    if (userId && undatedTasks) cacheUndated(userId, undatedTasks);
  }, [userId, undatedTasks]);

  useEffect(() => {
    if (!userId || tasks) return;
    const cached = readCachedTasks(userId);
    if (cached?.length) {
      setTasks(cached);
      setIsLoading(null);
    }
  }, [userId, tasks, setTasks, setIsLoading]);

  // O cache acompanha a TELA, não só o que veio do servidor: uma tarefa criada offline vive no
  // estado e na fila, e sem isto ela sumia ao fechar o app — só voltava depois do sync.
  // Adiado: o stringify síncrono da agenda inteira travava o quadro de cada toque. Sair da aba ou
  // fechar grava o que estiver pendente, então o cache não perde a última escrita.
  const pendingCache = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!userId || !tasks) return;
    const write = () => {
      pendingCache.current = null;
      cacheTasks(userId, tasks);
    };
    pendingCache.current = write;
    const id = setTimeout(write, CACHE_AFTER_MS);
    return () => clearTimeout(id);
  }, [userId, tasks]);
  useEffect(() => {
    const flush = () => pendingCache.current?.();
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, []);

  // 📅 Função principal para carregar as tasks
  const getTasks = useEffectEvent(async () => {
    if (!userId) return;

    setIsLoading(copy.loading.tasks);
    try {
      // A fila sobe ANTES da leitura: sem isso o servidor devolveria o estado velho e a tela
      // andaria pra trás por um instante.
      const { dropped } = await flushQueue(userId);
      // Descartada = o servidor recusou (quota, tarefa que já não existe). A tarefa vai sumir da
      // tela no fetch logo abaixo, e sumir sem explicação parece perda de dado.
      if (dropped) {
        toast.error(copy.sync.dropped.replace("{n}", String(dropped)));
      }
      // Depois da fila, nunca junto: lida antes, a Sem data voltava sem o que foi feito offline.
      loadUndated();

      // Hoje e o seguinte já no boot: a lista contínua não pode esperar a rolagem chegar no fim.
      const error = await reloadMonths([...loadedMonths, ...initialMonths(zoned()), selectedDay]);

      // Erro de carga não é mês vazio: sem o aviso, quem está sem rede lê "nada agendado" e acha
      // que perdeu as tarefas. Offline com cache na tela é silencioso — o indicador já conta.
      if (error) {
        if (!error.offline || !tasks?.length) {
          toast.error(copy.loading.tasksError, {
            id: "tasks-load-error",
            description: error.message,
          });
        }
        return;
      }
    } catch {
      // Sem isto o app trava no spinner para sempre: a exceção pulava o `setIsLoading(null)` e o
      // gate lá embaixo (`isLoading && !tasks`) nunca liberava. `setTasks([])` é o que destrava.
      // Mas só quando NÃO há nada na tela: zerar ali apagaria a agenda que o cache tinha acabado de
      // pintar.
      if (!tasks?.length) setTasks([]);
      toast.error(copy.loading.tasksError, { id: "tasks-load-error" });
    } finally {
      setIsLoading(null);
    }
  });
  const loadMonthOf = useEffectEvent(loadMonth);

  // O boot passa pela fila (`getTasks`); depois, dia em outro mês só soma aquele mês à lista.
  const booted = useRef(false);
  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (booted.current) {
      loadMonthOf(selectedDay);
      return;
    }
    booted.current = true;
    getTasks();
  }, [selectedDay, isLoaded, userId]);

  // O celular passa horas em segundo plano e volta com a lista de antes; tarefa criada no desktop
  // não aparecia. Revalida ao voltar pra aba e ao reconectar, com um piso de tempo pra alternar
  // de aba não virar rajada de fetch.
  const lastFetch = useRef(Date.now());
  useEffect(() => {
    if (!isLoaded || !userId) return;

    const revalidate = (force = false) => {
      if (document.visibilityState !== "visible") return;
      if (!force && Date.now() - lastFetch.current < REVALIDATE_AFTER_MS) return;
      lastFetch.current = Date.now();
      getTasks();
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
  const loading = !isLoaded || Boolean(isLoading && !tasks);
  const [held, setHeld] = useState(loading);
  useEffect(() => {
    if (!held) return;
    const id = setTimeout(() => setHeld(false), SPLASH_MIN_MS);
    return () => clearTimeout(id);
  }, [held]);
  const splash = loading || held;

  // 🧭 Redirecionar se não estiver logado
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
