import { ShieldIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem } from "./sidebar-item";

export function SecurityButton(): JSX.Element {
  return <SidebarItem icon={ShieldIcon} label={copy.profile.navSecurity} to="/security" />;
}
