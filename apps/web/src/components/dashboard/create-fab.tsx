import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { PlusIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { TaskComposer, type ComposerValues } from "@/components/dashboard/task-composer";
import { Dialog, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CreateFabProps {
  onSubmit: (values: ComposerValues) => void;
  submitting?: boolean;
  /** Tela Sem data do mobile: o "+" cria sem data. */
  undatedOnly?: boolean;
}

/**
 * O "+" e a folha de criação. Sem portal de propósito: no desktop a folha se ancora no próprio
 * botão (que mora no painel da agenda e desliza com ele); no mobile os dois são `fixed`.
 */
export function CreateFab({ onSubmit, submitting, undatedOnly }: CreateFabProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const label = undatedOnly ? copy.composer.openUndated : copy.composer.open;

  // "n" e "/" abrem a folha de qualquer lugar da página, menos de quem já está escrevendo ou de
  // outro diálogo aberto.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" && event.key !== "n") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input,textarea,select"))
      )
        return;

      event.preventDefault();
      setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 h-0 md:sticky">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          aria-label={label}
          className={cn(
            "absolute right-4 bottom-4 flex size-12 cursor-pointer items-center justify-center md:right-6 md:bottom-6",
            "rounded-2xl bg-accent-primary text-primary-foreground shadow-fab hover:bg-accent-hover",
            "transition-[scale,opacity,background-color] duration-150 ease-out active:scale-96",
            "motion-reduce:transition-[opacity,background-color]",
            open && "pointer-events-none scale-90 opacity-0",
          )}
        >
          <PlusIcon className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </DialogTrigger>

        <DialogPrimitive.Overlay className="fixed inset-0 bg-surface-scrim md:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 rounded-t-panel border-t border-highlight bg-surface-panel px-2 pt-2 pb-safe shadow-panel",
            "md:absolute md:inset-x-auto md:right-6 md:bottom-6 md:w-sheet md:rounded-panel md:border md:p-1",
            // Entrada: cresce a partir do canto do botão (no mobile, do rodapé).
            "origin-bottom transition-[scale,opacity] duration-200 ease-out-expo md:origin-bottom-right",
            "starting:scale-95 starting:opacity-0 motion-reduce:starting:scale-100",
          )}
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <TaskComposer
            submitting={submitting}
            undatedOnly={undatedOnly}
            onSubmit={(values, again) => {
              onSubmit(values);
              if (!again) setOpen(false);
            }}
          />
        </DialogPrimitive.Content>
      </Dialog>
    </div>
  );
}
