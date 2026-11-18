import { PLAN_ID as SHARED_PLAN_ID } from "@dailify/shared";
export const priorityText = ["Sem prioridade", "Baixa", "Média", "Alta", "Urgente"];
export const priorityTextColor = [
  "text-priority-0",
  "text-priority-1",
  "text-priority-2",
  "text-priority-3",
  "text-priority-4",
];

// Reexport, não segunda declaração: o `PLAN_ID` é do modelo (`@dailify/shared`), que é quem o
// servidor também lê. Duas listas de ids iguais só ficam iguais até alguém mexer numa.
export { PLAN_ID } from "@dailify/shared";

/** Rótulo de exibição do plano. Fica no web porque é UI: o servidor nunca mostra plano pra ninguém. */
export const planMap: Record<string, "Free" | "Pro" | "Max"> = {
  [SHARED_PLAN_ID.free]: "Free",
  [SHARED_PLAN_ID.pro]: "Pro",
  [SHARED_PLAN_ID.max]: "Max",
};

/** `?view=calendar` abre o mês em `/dashboard`: o voltar do aparelho fecha. */
export const CALENDAR_VIEW = "calendar";

// Dev usa o proxy do vite.config (dev server é HTTPS, worker é HTTP = mixed content). bd Dailify-6aq
// No dev do app mobile, `VITE_DEV_API` é a API local direta: lá o proxy do Tauri perde o corpo dos POSTs.
export const apiURL = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_API
  : import.meta.env.VITE_API_URL;
