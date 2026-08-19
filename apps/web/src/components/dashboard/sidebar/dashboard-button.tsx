import { LayoutListIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem } from "./sidebar-item";

export function DashboardButton(): JSX.Element {
  return <SidebarItem icon={LayoutListIcon} label={copy.profile.navDashboard} to="/dashboard" />;
}
