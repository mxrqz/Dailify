import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { CALENDAR_VIEW } from "@/consts/conts";

/** `?view=calendar` on the dashboard: an entry of its own, so the device's back closes it. */
export function useCalendarView(): { open: boolean; show: () => void; close: () => void } {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  return {
    open: params.get("view") === CALENDAR_VIEW,
    show: () => navigate({ search: `?view=${CALENDAR_VIEW}` }),
    // Landed straight on it: there's no entry to go back to, so drop the param.
    close: () => (location.key === "default" ? setParams({}, { replace: true }) : navigate(-1)),
  };
}
