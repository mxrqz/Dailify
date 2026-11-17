import { useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { SettingsRowButton } from "@/components/settings-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearLocal } from "@/functions/offline";

/**
 * Excluir a conta. O trabalho pesado é do servidor: `user.delete()` faz o Clerk disparar
 * `user.deleted`, e o webhook (`routes/clerk-webhook.ts`) apaga as tarefas no D1 e cancela a
 * assinatura no Stripe. Aqui só se confirma a intenção e se limpa o rastro local.
 *
 * Confirmação por digitação, não "tem certeza?": é a única ação do app sem volta — não há
 * "Desfazer" possível depois que a conta some.
 */
export function DeleteAccount(): JSX.Element | null {
  const { user } = useUser();
  const { signOut, userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const confirmed = typed.trim().toLowerCase() === email.toLowerCase();

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);

    try {
      await user.delete();
    } catch {
      toast.error(copy.profile.deleteAccountError);
      setDeleting(false);
      return;
    }

    if (userId) clearLocal(userId);
    // A sessão já morreu com a conta; se o signOut falhar, a saída é ir embora do mesmo jeito.
    await signOut({ redirectUrl: "/" }).catch(() => {
      window.location.href = "/";
    });
  };

  // Uma linha do grupo Conta, com o nome em destructive: o vermelho marca o assunto sem transformar
  // a página inteira num alerta.
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <SettingsRowButton
          label={copy.profile.deleteAccount}
          hint={copy.profile.dangerDescription}
          danger
        />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.profile.deleteConfirmTitle}</DialogTitle>
          <DialogDescription>{copy.profile.deleteConfirmDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-email">
            {copy.profile.deleteConfirmPrompt.replace("{email}", email)}
          </Label>
          <Input
            id="confirm-email"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            placeholder={email}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            {copy.form.cancel}
          </Button>

          <Button
            variant="soft-danger"
            disabled={!confirmed || deleting}
            onClick={() => void handleDelete()}
          >
            {deleting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              copy.profile.deleteConfirmCta
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
