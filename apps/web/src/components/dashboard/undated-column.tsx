import { ChevronLeft } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { useStoredFlag } from "@/hooks/useStoredFlag";
import { cn } from "@/lib/utils";

const OPEN_KEY = "dailify:undated-open";

/** Aberta ou fechada, lembrado por device. */
export const useUndatedOpen = () => useStoredFlag(OPEN_KEY);

const motion = "duration-200 ease-out-expo motion-reduce:transition-none";

/**
 * A coluna lateral do desktop (`md:` pra cima) e o puxador que a abre. É coluna do layout, não
 * drawer: anima a largura (e o gap, via margem) pra a agenda ao lado encolher. Vazia por enquanto:
 * a Sem data virou o bloco "A qualquer hora" de hoje.
 */
export function UndatedColumn({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  return (
    <>
      <div
        id="undated-column"
        aria-hidden={!open}
        className={cn(
          "sticky top-11 hidden h-[calc(100dvh-3rem)] shrink-0 self-start overflow-hidden rounded-field bg-surface transition-[width,margin-left,visibility] md:block",
          motion,
          open ? "ml-1 w-undated" : "invisible ml-0 w-0",
        )}
      />

      <button
        type="button"
        aria-expanded={open}
        aria-controls="undated-column"
        aria-label={open ? copy.column.close : copy.column.open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "fixed top-1/2 right-0 z-30 hidden size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-xl border border-separator bg-surface-raised text-ink-secondary transition-[translate,background-color] hover:bg-fill md:grid",
          motion,
          open ? "translate-x-(--undated-handle-x)" : "translate-x-1/2",
        )}
      >
        <ChevronLeft
          aria-hidden
          className={cn(
            "size-3 transition-transform",
            motion,
            open ? "rotate-180" : "-translate-x-2.25",
          )}
        />
      </button>
    </>
  );
}
