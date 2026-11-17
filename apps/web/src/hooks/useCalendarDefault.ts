import { useStoredFlag } from "@/hooks/useStoredFlag";

/** "Novas tarefas na Agenda": Sempre (true) ou Nunca, por device. Nasce Nunca. */
export const CALENDAR_DEFAULT_KEY = "dailify:new-tasks-google-calendar";
/** O padrão da etiqueta Google Agenda do composer; quem escolhe é a linha de Configurações. */
export const useCalendarDefault = () => useStoredFlag(CALENDAR_DEFAULT_KEY);
