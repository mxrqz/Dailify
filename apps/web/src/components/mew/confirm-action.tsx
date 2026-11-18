import { Switch } from "@/components/kit/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { copy as t } from "./copy";
import { MewStatic } from "./mew-static";

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
            <DialogDescription className="text-ink-secondary">{preview}</DialogDescription>
          </div>
        </DialogHeader>
        {option && (
          <div className="flex items-center justify-between gap-3 rounded-field bg-fill px-3 py-2.5 text-sm">
            <span aria-hidden="true">{option.label}</span>
            <Switch
              aria-label={option.label}
              checked={option.checked}
              disabled={pending}
              onCheckedChange={option.onChange}
            />
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button loading={pending} onClick={onConfirm}>
            {t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
