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

export const PLAN_ID = { free: "free", pro: "pro", proAi: "pro+ai" } as const;

export const planMap: Record<string, "Free" | "Pro" | "Pro + AI"> = {
  [PLAN_ID.free]: "Free",
  [PLAN_ID.pro]: "Pro",
  [PLAN_ID.proAi]: "Pro + AI",
};

export const apiURL = import.meta.env.VITE_API_URL;
export const dailifyURL = "https://dailify.mxrqz.com/";
