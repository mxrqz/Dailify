import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { copy } from "@/components/dashboard/copy";
import { cn } from "@/lib/utils";

/**
 * Escolha entre a ocorrência e a série — usada ao editar e ao excluir uma tarefa recorrente.
 * "Só esta" vem primeiro por ser o caso comum (remarcar ou pular um dia), e é a ação em destaque.
 */
export function RecurrenceScopeDialog({
  open,
  onOpenChange,
  description,
  destructive = false,
  onOccurrence,
  onSeries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  /** Excluir pinta as duas opções de destrutivo: as duas tiram tarefa da tela. */
  destructive?: boolean;
  onOccurrence: () => void;
  onSeries: () => void;
}): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-panel border-surface-line bg-surface-card sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{copy.form.scopeTitle}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button
            variant={destructive ? "destructive" : "default"}
            className={cn(
              "h-12 cursor-pointer rounded-full",
              // fora do destrutivo, a ação principal usa o accent do app, não o `primary` do shadcn
              !destructive && "bg-accent-primary text-primary-foreground hover:bg-accent-hover",
            )}
            onClick={onOccurrence}
          >
            {copy.form.scopeOccurrence}
          </Button>
          <Button
            variant="outline"
            className="h-12 cursor-pointer rounded-full border-surface-line"
            onClick={onSeries}
          >
            {copy.form.scopeSeries}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
