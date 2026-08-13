import { SettingsIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem, type SidebarItemProps } from "./sidebar-item";

export function SettingsButton(props: SidebarItemProps): JSX.Element {
  return (
    <SidebarItem
      icon={SettingsIcon}
      label={copy.profile.navSettings}
      to="/profile?tab=settings"
      {...props}
    />
  );
}
