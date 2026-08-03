export const priorityText = ["Not Important", "Low", "Medium", "High", "Very Important"];
export const priorityTextColor = [
  "text-gray-500",
  "text-green-500",
  "text-yellow-500",
  "text-orange-500",
  "text-red-500",
];
export const priorityBorderColor = [
  "border-gray-500",
  "border-green-500",
  "border-yellow-500",
  "border-orange-500",
  "border-red-500",
];
export const priorityBgColor = [
  "bg-gray-500/10",
  "bg-green-500/10",
  "bg-yellow-500/10",
  "bg-orange-500/10",
  "bg-red-500/10",
];
export const prioritySelectedBgColor = [
  "data-[state=on]:bg-gray-500/70",
  "data-[state=on]:bg-green-500/70",
  "data-[state=on]:bg-yellow-500/70",
  "data-[state=on]:bg-orange-500/70",
  "data-[state=on]:bg-red-500/70",
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

export const paletteColors = [
  "bg-palette-1",
  "bg-palette-2",
  "bg-palette-3",
  "bg-palette-4",
  "bg-palette-5",
  "bg-palette-6",
  "bg-palette-7",
  "bg-palette-8",
  "bg-palette-9",
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

export const variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 1,
      staggerChildren: 0.1,
    },
  },
};

export const childVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

export const PLAN_ID = { free: "free", pro: "pro", proAi: "pro+ai" } as const;

export const planMap: Record<string, "Free" | "Pro" | "Pro + AI"> = {
  [PLAN_ID.free]: "Free",
  [PLAN_ID.pro]: "Pro",
  [PLAN_ID.proAi]: "Pro + AI",
};

export const apiURL = import.meta.env.VITE_API_URL;
export const dailifyURL = "https://dailify.mxrqz.com/";
