import { CrownIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem } from "./sidebar-item";

export function PremiumButton(): JSX.Element {
  return (
    <SidebarItem
      icon={CrownIcon}
      label={copy.profile.navPremium}
      to="/billing"
      alsoActive="/premium"
    />
  );
}
