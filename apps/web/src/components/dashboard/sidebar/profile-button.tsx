import { UserIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem } from "./sidebar-item";

export function ProfileButton(): JSX.Element {
  return <SidebarItem icon={UserIcon} label={copy.profile.navPersonal} to="/profile" />;
}
