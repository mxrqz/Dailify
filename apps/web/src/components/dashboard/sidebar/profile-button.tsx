import { UserIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem, type SidebarItemProps } from "./sidebar-item";

export function ProfileButton(props: SidebarItemProps): JSX.Element {
  return (
    <SidebarItem
      icon={UserIcon}
      label={copy.profile.navPersonal}
      to="/profile?tab=personal"
      {...props}
    />
  );
}
