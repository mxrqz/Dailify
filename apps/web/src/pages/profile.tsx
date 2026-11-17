import { useState } from "react";
import { Loader2Icon, LockIcon } from "lucide-react";
import { toast } from "sonner";

import { copy } from "@/components/dashboard/copy";
import { DeleteAccount } from "@/components/delete-account";
import { ListGroup, ListRow } from "@/components/kit/list";
import { PageHeader } from "@/components/kit/page-header";
import { accountGroups, accountPage } from "@/components/settings-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth";
import { formString } from "@/lib/form";

/** Foto (a do Google, ou a inicial), nome e e-mail. Só props. */
export function ProfileHero({
  name,
  email,
  imageUrl,
}: {
  name: string;
  email?: string;
  imageUrl?: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-4 px-1 pt-5">
      <Avatar className="size-18 flex-none rounded-full">
        <AvatarImage src={imageUrl} alt="" />
        <AvatarFallback className="rounded-full bg-fill text-3xl font-semibold text-ink">
          {(name || email || "").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-title-3 font-semibold">{name}</span>
        <span className="truncate text-subhead text-ink-secondary">{email}</span>
      </div>
    </div>
  );
}

export default function ProfilePage(): JSX.Element {
  const user = useSession().data?.user;
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = formString(new FormData(e.currentTarget), "name").trim();
    if (name === user?.name) return setEditOpen(false);

    setSaving(true);
    const { error } = await authClient.updateUser({ name }).catch(() => ({ error: true }));
    setSaving(false);
    if (error) return void toast.error(copy.profile.nameError);
    setEditOpen(false);
  };

  // Página inteira: derruba o estado em memória (tarefas, cotas) de quem saiu.
  const signOut = () => void authClient.signOut().finally(() => window.location.assign("/"));

  const name = user?.name ?? "";
  const edit = () => setEditOpen(true);

  return (
    <main className={accountPage}>
      <PageHeader title={copy.profile.pageTitle} className="px-1" />

      <ProfileHero name={name} email={user?.email} imageUrl={user?.image ?? undefined} />

      <div className={accountGroups}>
        <ListGroup title={copy.profile.groupData} footer={copy.profile.emailLocked}>
          <ListRow
            label={copy.profile.name}
            value={name || <span className="text-ink-tertiary">{copy.profile.empty}</span>}
            accessory="chevron"
            onClick={edit}
          />
          <ListRow
            label={copy.profile.email}
            value={user?.email}
            trailing={<LockIcon className="size-4 text-ink-secondary" aria-hidden="true" />}
          />
        </ListGroup>

        <ListGroup title={copy.profile.groupAccount} footer={copy.profile.dangerDescription}>
          <ListRow label={copy.profile.signOut} onClick={signOut} />
          <DeleteAccount />
        </ListGroup>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.profile.editTitle}</DialogTitle>
            <DialogDescription>{copy.profile.editDescription}</DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="name">{copy.profile.name}</Label>
              <Input
                id="name"
                name="name"
                required
                autoComplete="name"
                defaultValue={name}
                placeholder={copy.profile.name}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  {copy.form.cancel}
                </Button>
              </DialogClose>

              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2Icon className="animate-spin" />
                    <span>{copy.profile.saving}</span>
                  </>
                ) : (
                  copy.form.save
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
