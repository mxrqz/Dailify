import { ReactNode, useEffect, useState, useCallback } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2Icon } from "lucide-react";
import { useDailify } from "./dailifyContext";
import { auth, getTasksForMonth } from "@/functions/firebase";
import { isSameMonth } from "date-fns";
import {
  signInWithCustomToken,
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { serverURL } from "@/consts/conts";
import { motion } from "framer-motion";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const {
    selectedDay,
    setTasks,
    setIsLoading,
    isLoading,
    newTask,
    setCurrentMonth,
    currentMonth,
    setCurrentMonthTasks,
    setInvoices,
    setPaymentDetails,
    setPermissions,
  } = useDailify();

  const location = useLocation();
  const { getToken, userId } = useAuth();
  const [isFirebaseLogged, setIsFirebaseLogged] = useState(false);

  const paymentData = async () => {
    const token = await getToken();

    const response = await fetch(`${serverURL}paymentDetails`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const paymentDetails = await response.json();
    setPaymentDetails(paymentDetails);
  };

  const getPermissions = async () => {
    const token = await getToken();

    const response = await fetch(`${serverURL}permissions`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const permissions = await response.json();
    setPermissions(permissions);
  };

  const getInvoices = async () => {
    const token = await getToken();

    const response = await fetch(`${serverURL}invoicesList`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const invoices = await response.json();

    setInvoices(invoices);
  };

  useEffect(() => {
    paymentData();
    getPermissions();
    getInvoices();
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser && userId) {
        const token = await getToken({ template: "integration_firebase" });
        if (token) {
          await signInWithCustomToken(auth, token);
        }
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // 🔐 Login Firebase com token do Clerk
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) return setIsFirebaseLogged(true);
      if (!userId) return;

      const token = await getToken({ template: "integration_firebase" });
      if (!token) return;

      try {
        await setPersistence(auth, browserLocalPersistence);
        const creds = await signInWithCustomToken(auth, token);
        if (creds.user) setIsFirebaseLogged(true);
      } catch (err) {
        console.error("Erro ao logar no Firebase:", err);
      }
    });

    return () => unsubscribe();
  }, [userId]);

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
    if (!userId || !user || !isFirebaseLogged) return;

    setIsLoading("Carregando tarefas");
    const tasks = await getTasksForMonth(userId, selectedDay);

    if (isSameMonth(new Date(), selectedDay)) {
      setCurrentMonthTasks(tasks);
    }

    setTasks(tasks);
    setIsLoading(null);
  }, [userId, user, isFirebaseLogged, selectedDay]);

  // 🗓️ Atualizar tarefas se mudar de mês
  useEffect(() => {
    if (!isLoaded || !isFirebaseLogged) return;

    const shouldUpdateMonth = !currentMonth || !isSameMonth(currentMonth, selectedDay);
    if (shouldUpdateMonth) {
      setCurrentMonth(selectedDay);
      getTasks();
    }
  }, [selectedDay, newTask, isLoaded, isFirebaseLogged]);

  // ▶️ Rodar quando estiver tudo pronto
  useEffect(() => {
    if (isLoaded && isFirebaseLogged && user) {
      getTasks();
    }
  }, [isLoaded, isFirebaseLogged, user]);

  // 🧭 Redirecionar se não estiver logado
  if (!isLoaded || isLoading) {
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
