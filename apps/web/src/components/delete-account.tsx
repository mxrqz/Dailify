import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { copy } from "@/components/dashboard/copy";
import { ListRow } from "@/components/kit/list";
import { Button } from "@/components/ui/button";
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
import { authClient, useSession } from "@/lib/auth";
import { signOutAndReload } from "@/lib/native-auth";

/**
 * Excluir a conta. O trabalho pesado é do servidor: `deleteUser()` roda o `beforeDelete` /
 * `afterDelete` do Better Auth, que cancelam o Stripe e apagam os dados no D1. Aqui só se confirma
 * a intenção e se limpa o rastro local.
 *
 * Confirmação por digitação, não "tem certeza?": é a única ação do app sem volta — não há
 * "Desfazer" possível depois que a conta some.
 */
export function DeleteAccount(): JSX.Element | null {
  const user = useSession().data?.user;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const email = user.email;
  const confirmed = typed.trim().toLowerCase() === email.toLowerCase();

  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);

    const { error } = await authClient.deleteUser().catch(() => ({ error: { code: undefined } }));
    if (error) {
      setDeleting(false);
      // Sessão mais velha que o `freshAge` do servidor: só uma entrada nova autoriza excluir.
      // Recarrega como todo "sair" (o toast morreria junto): o aviso vai pelo `?error=` do /login.
      if (error.code === "SESSION_EXPIRED") return signOutAndReload("/login?error=SESSION_EXPIRED");
      toast.error(copy.profile.deleteAccountError);
      return;
    }

    clearLocal(user.id);
    // A sessão já morreu com a conta; o signOut só limpa o cookie, e a página inteira recarrega.
    signOutAndReload();
  };

  // Uma linha do grupo Conta, com o nome em vermelho: marca o assunto sem transformar a página
  // inteira num alerta. A explicação é o rodapé do grupo, em /profile.
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <ListRow label={copy.profile.deleteAccount} danger />
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
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
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
