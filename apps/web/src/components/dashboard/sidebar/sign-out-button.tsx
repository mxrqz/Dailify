import { useAuth } from "@clerk/clerk-react";
import { LogOutIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { sidebarItemClass } from "./sidebar-item";

export function SignOutButton(): JSX.Element {
  const { signOut } = useAuth();

  return (
    <button type="button" onClick={() => signOut()} className={sidebarItemClass(false)}>
      <LogOutIcon className="size-4 shrink-0" aria-hidden="true" />
      {copy.profile.signOut}
    </button>
  );
}
