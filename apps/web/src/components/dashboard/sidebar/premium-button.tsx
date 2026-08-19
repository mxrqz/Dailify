import { CrownIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem, type SidebarItemProps } from "./sidebar-item";

export function PremiumButton(props: SidebarItemProps): JSX.Element {
  return <SidebarItem icon={CrownIcon} label={copy.profile.navPremium} to="/billing" {...props} />;
}
