import { useState } from "react";
import { ChevronLeft } from "lucide-react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { pendingLabel, UndatedList } from "@/components/dashboard/undated-list";
import { pendingUndated } from "@/functions/undated";
import { cn } from "@/lib/utils";

const OPEN_KEY = "dailify:undated-open";

/** Aberta ou fechada, lembrado por device. */
export function useUndatedOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  const change = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // sem storage (aba privada) a coluna só não é lembrada
    }
  };

  return [open, change];
}

const motion = "duration-200 ease-out-expo motion-reduce:transition-none";

/**
 * A coluna Sem data do desktop (`md:` pra cima) e o puxador que a abre. É coluna do layout, não
 * drawer: anima a largura (e o gap, via margem) pra a agenda ao lado encolher.
 */
export function UndatedColumn({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const { undatedTasks, weekStart } = useDailify();
  const pending = pendingUndated(undatedTasks ?? [], Date.now(), weekStart);

  return (
    <>
      <div
        id="undated-column"
        aria-hidden={!open}
        className={cn(
          "sticky top-11 hidden h-[calc(100dvh-3rem)] shrink-0 self-start overflow-hidden rounded-field bg-surface-card transition-[width,margin-left,visibility] md:block",
          motion,
          open ? "ml-1 w-undated" : "invisible ml-0 w-0",
        )}
      >
        <UndatedList className="h-full w-undated overflow-y-auto px-4 py-4.5" />
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls="undated-column"
        aria-label={
          open
            ? copy.undated.closeHandle
            : copy.undated.openHandle.replace("{pending}", pendingLabel(pending))
        }
        onClick={() => onOpenChange(!open)}
        className={cn(
          "fixed top-1/2 right-0 z-30 hidden size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-xl border border-highlight bg-surface-panel text-content-secondary transition-[translate,background-color] hover:bg-surface-hover md:grid",
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
        {!open && pending > 0 && (
          <span className="absolute -top-1.75 -left-1.75 grid h-4 min-w-4 place-items-center rounded-full bg-accent-primary px-1 text-2xs font-semibold text-primary-foreground">
            {pending}
          </span>
        )}
      </button>
    </>
  );
}
