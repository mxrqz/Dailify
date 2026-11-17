import { Loader2Icon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { MewStatic } from "./mew-static";

const t = copy.confirmAction;

/**
 * A confirmação de toda ação externa (epic zpq): nada sai da Mewki sem a pessoa ver o que vai
 * acontecer e confirmar. Provider novo reusa este cartão com o próprio `preview` e opção.
 */
export function ConfirmAction({
  open,
  onOpenChange,
  preview,
  option,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O texto da action ("Criar evento na Agenda · amanhã 15:00–15:30"). */
  preview: string;
  /** Um ajuste opcional antes de confirmar (ex.: "Criar link do Meet"). */
  option?: { label: string; checked: boolean; onChange: (checked: boolean) => void };
  pending?: boolean;
  onConfirm: () => void;
}): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="flex-row items-start gap-3 text-left">
          <MewStatic className="w-8 flex-none" />
          <div className="flex flex-col gap-1.5">
            <DialogTitle className="text-base">{t.title}</DialogTitle>
            <DialogDescription className="text-content-secondary">{preview}</DialogDescription>
          </div>
        </DialogHeader>
        {option && (
          <label className="flex items-center justify-between gap-3 rounded-field bg-surface-panel px-3 py-2.5 text-sm">
            {option.label}
            <input
              type="checkbox"
              role="switch"
              checked={option.checked}
              disabled={pending}
              onChange={(e) => option.onChange(e.target.checked)}
              className="size-4 accent-accent-primary"
            />
          </label>
        )}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="rounded-sm"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t.cancel}
          </Button>
          <Button
            className="rounded-sm bg-accent-primary text-primary-foreground hover:bg-accent-hover"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <Loader2Icon className="animate-spin" aria-label={t.confirm} /> : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
