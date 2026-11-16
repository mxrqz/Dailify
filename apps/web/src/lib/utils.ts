import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Tamanhos e raios do `global.css` fora do padrão xs/sm/lg: sem isso o twMerge lê `text-subhead`
// como cor e o descarta ao lado de `text-ink-secondary`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["title-1", "title-3", "body", "subhead", "footnote"],
      radius: ["sheet", "panel", "field"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Metadados do Clerk e campos opcionais chegam como `unknown` — evita um `as string` por leitura. */
export function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
