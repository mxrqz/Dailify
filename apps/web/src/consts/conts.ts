import { PLAN_ID as SHARED_PLAN_ID } from "@dailify/shared";
export const priorityText = ["Sem prioridade", "Baixa", "Média", "Alta", "Urgente"];
export const priorityTextColor = [
  "text-priority-0",
  "text-priority-1",
  "text-priority-2",
  "text-priority-3",
  "text-priority-4",
];
export const priorityBorderColor = [
  "border-priority-0",
  "border-priority-1",
  "border-priority-2",
  "border-priority-3",
  "border-priority-4",
];
export const priorityBgColor = [
  "bg-priority-bg-0",
  "bg-priority-bg-1",
  "bg-priority-bg-2",
  "bg-priority-bg-3",
  "bg-priority-bg-4",
];
// Selecionado = contorno + texto na cor, NÃO fill sólido. Um fill saturado poria o `text-foreground`
// herdado do ToggleGroupItem sobre priority-4 (70% L no dark) — contraste ruim, e um bloco de cor
// chapado destoa do sistema, que trata cartão e chip como contorno. O `/70` antigo saiu junto (k00).
/** Escolhida: contorno e texto na cor da prioridade (o chip do formulário controla o estado). */
export const prioritySelectedColor = [
  "border-priority-0 text-priority-0",
  "border-priority-1 text-priority-1",
  "border-priority-2 text-priority-2",
  "border-priority-3 text-priority-3",
  "border-priority-4 text-priority-4",
];
export const prioritySelectedBgColor = [
  "data-[state=on]:border-priority-0 data-[state=on]:text-priority-0",
  "data-[state=on]:border-priority-1 data-[state=on]:text-priority-1",
  "data-[state=on]:border-priority-2 data-[state=on]:text-priority-2",
  "data-[state=on]:border-priority-3 data-[state=on]:text-priority-3",
  "data-[state=on]:border-priority-4 data-[state=on]:text-priority-4",
];
export const tagsBgColors2 = [
  "bg-tag-1",
  "bg-tag-2",
  "bg-tag-3",
  "bg-tag-4",
  "bg-tag-5",
  "bg-tag-6",
  "bg-tag-7",
  "bg-tag-8",
  "bg-tag-9",
];
export const tagsBorderColors2 = [
  "border-tag-1",
  "border-tag-2",
  "border-tag-3",
  "border-tag-4",
  "border-tag-5",
  "border-tag-6",
  "border-tag-7",
  "border-tag-8",
  "border-tag-9",
];

export const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Reexport, não segunda declaração: o `PLAN_ID` é do modelo (`@dailify/shared`), que é quem o
// servidor também lê. Duas listas de ids iguais só ficam iguais até alguém mexer numa.
export { PLAN_ID } from "@dailify/shared";

/** Rótulo de exibição do plano. Fica no web porque é UI: o servidor nunca mostra plano pra ninguém. */
export const planMap: Record<string, "Free" | "Pro" | "Pro + AI"> = {
  [SHARED_PLAN_ID.free]: "Free",
  [SHARED_PLAN_ID.pro]: "Pro",
  [SHARED_PLAN_ID.proAi]: "Pro + AI",
};

// Dev usa o proxy do vite.config (dev server é HTTPS, worker é HTTP = mixed content). bd Dailify-6aq
export const apiURL = import.meta.env.DEV ? "/api" : import.meta.env.VITE_API_URL;
export const dailifyURL = "https://dailify.mxrqz.com/";
