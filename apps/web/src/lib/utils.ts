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
    // Camadas nomeadas (`--z-index-*`) e os paddings do `global.css`: sem isso `z-chat` e `pb-0`
    // não substituem o `z-50` e o `pb-safe` da folha.
    classGroups: { z: [{ z: ["chat", "dock"] }], pb: [{ pb: ["safe", "dock", "dock-clear"] }] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
