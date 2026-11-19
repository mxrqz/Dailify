import { useNavigate } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import { ActionSheet } from "@/components/kit/action-sheet";
import { setCreditsTray, useCreditsTray } from "@/hooks/useCreditsTray";

const t = copy.quota;

/** AI credits ran out: a tray over the screen instead of a trip to /premium. Mounted once in AppLayout. */
export function CreditsTray(): JSX.Element {
  const open = useCreditsTray();
  const navigate = useNavigate();
  return (
    <ActionSheet
      open={open}
      onOpenChange={setCreditsTray}
      title={t.trayTitle}
      description={t.trayBody}
      actions={[{ label: t.trayUpgrade, primary: true, onSelect: () => navigate("/premium") }]}
      cancelLabel={t.trayLater}
    />
  );
}
