import { LayoutListIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem, type SidebarItemProps } from "./sidebar-item";

export function DashboardButton(props: SidebarItemProps): JSX.Element {
  return (
    <SidebarItem
      icon={LayoutListIcon}
      label={copy.profile.navDashboard}
      to="/dashboard"
      {...props}
    />
  );
}
