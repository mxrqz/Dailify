import * as DialogPrimitive from "@radix-ui/react-dialog";

import { DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { copy } from "./copy";

export interface ActionSheetAction {
  label: string;
  onSelect: () => void;
  /** A escolha recomendada: negrito e vermelho (accent-text), como "Só esta ocorrência". */
  primary?: boolean;
  /** Tira algo da tela: vermelho sem o negrito. */
  destructive?: boolean;
}

const option =
  "h-14 w-full cursor-pointer text-xl leading-6 tracking-tight text-ink outline-none transition-colors pointer-fine:active:bg-fill-pressed pointer-fine:focus-visible:bg-fill";

/**
 * Pergunta de múltipla escolha do iOS: as opções num card de vidro e "Cancelar" num card próprio,
 * sobre o scrim. Toda escolha fecha a folha. Cada card é um vidro (o contêiner só desliza: fade
 * nele mataria o blur dos dois).
 */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  actions,
  cancelLabel = copy.cancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}): JSX.Element {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          role="alertdialog"
          // Sem descrição o Radix avisa no console; com ela, ele mesmo liga o aria-describedby.
          {...(!description && { "aria-describedby": undefined })}
          className="fixed inset-x-2 bottom-2 z-overlay mx-auto flex max-w-md flex-col gap-2 pb-safe outline-none data-[state=open]:animate-in motion-reduce:animate-none! data-[state=open]:slide-in-from-bottom-full data-[state=open]:duration-slow data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full data-[state=closed]:duration-base data-[state=closed]:ease-exit"
        >
          <div className="glass rounded-md text-center">
            <div className="px-4 pt-3.5 pb-3">
              <DialogPrimitive.Title className="text-subhead font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-footnote text-ink-secondary">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            {actions.map((action) => (
              <DialogPrimitive.Close asChild key={action.label}>
                <button
                  type="button"
                  onClick={action.onSelect}
                  className={cn(
                    option,
                    "border-t border-separator last:rounded-b-md",
                    (action.primary || action.destructive) && "text-brand-text",
                    action.primary && "font-semibold",
                  )}
                >
                  {action.label}
                </button>
              </DialogPrimitive.Close>
            ))}
          </div>
          <DialogPrimitive.Close className={cn(option, "glass rounded-md font-semibold")}>
            {cancelLabel}
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
