import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Minimize2, Pin, PlusIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { TaskComposer, type ComposerValues } from "@/components/dashboard/task-composer";
import { Dialog, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useStoredFlag } from "@/hooks/useStoredFlag";
import { cn } from "@/lib/utils";

const DOCKED_KEY = "dailify:composer-docked";

const iconButton =
  "flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground";

interface CreateFabProps {
  onSubmit: (values: ComposerValues) => void;
  submitting?: boolean;
  /** Tela Sem data do mobile: o "+" cria sem data. */
  undatedOnly?: boolean;
}

/**
 * A criação, em dois modos lembrados por device: só o "+" que abre a folha, ou o campo sempre
 * aberto no rodapé do painel (largura toda). Sem portal de propósito: no desktop a folha se ancora
 * no próprio botão, que mora no painel da agenda e desliza com ele.
 */
export function CreateFab({ onSubmit, submitting, undatedOnly }: CreateFabProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useStoredFlag(DOCKED_KEY);
  const label = undatedOnly ? copy.composer.openUndated : copy.composer.open;

  // "n" e "/" abrem a folha de qualquer lugar da página, menos de quem já está escrevendo ou de
  // outro diálogo ou menu aberto.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" && event.key !== "n") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing || event.repeat)
        return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"]')) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input,textarea,select"))
      )
        return;

      event.preventDefault();
      if (docked) document.getElementById("composer-text")?.focus();
      else setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [docked]);

  if (docked) {
    return (
      // pb-16 no mobile: o campo para acima do indicador de páginas, que é fixed em bottom-6.
      <div className="sticky bottom-0 z-40 mt-auto px-4 pb-16 md:px-6 md:pb-6">
        <section
          aria-label={label}
          className="relative rounded-panel border border-highlight bg-surface-panel p-1 shadow-panel"
        >
          <TaskComposer
            submitting={submitting}
            undatedOnly={undatedOnly}
            onSubmit={(values) => onSubmit(values)}
          />
          <button
            type="button"
            aria-label={copy.composer.minimize}
            onClick={() => setDocked(false)}
            className={cn(
              iconButton,
              "absolute -top-3.5 right-4 border border-highlight bg-surface-panel",
            )}
          >
            <Minimize2 className="size-3.5" aria-hidden="true" />
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 h-0 md:sticky md:mt-auto">
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
          <button
            type="button"
            aria-label={copy.composer.pin}
            onClick={() => {
              setDocked(true);
              setOpen(false);
            }}
            className={cn(
              iconButton,
              "absolute -top-3.5 right-4 border border-highlight bg-surface-panel",
            )}
          >
            <Pin className="size-3.5" aria-hidden="true" />
          </button>
        </DialogPrimitive.Content>
      </Dialog>
    </div>
  );
}
