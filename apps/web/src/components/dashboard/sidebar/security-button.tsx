import { ShieldIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem, type SidebarItemProps } from "./sidebar-item";

export function SecurityButton(props: SidebarItemProps): JSX.Element {
  return (
    <SidebarItem icon={ShieldIcon} label={copy.profile.navSecurity} to="/security" {...props} />
  );
}
