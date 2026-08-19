import { SettingsIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem } from "./sidebar-item";

export function SettingsButton(): JSX.Element {
  return <SidebarItem icon={SettingsIcon} label={copy.profile.navSettings} to="/settings" />;
}
