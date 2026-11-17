import { useAuth } from "@clerk/clerk-react";
import { isWeekStart } from "@dailify/shared";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { saveSettings } from "@/functions/api";

/** Otimista: aplica já e volta ao anterior se a API falhar. */
export function WeekStartSelect(): JSX.Element {
  const { weekStart, setWeekStart } = useDailify();
  const { getToken } = useAuth();

  const choose = async (value: string) => {
    const next = Number(value);
    if (!isWeekStart(next) || next === weekStart) return;
    const previous = weekStart;
    setWeekStart(next);
    const token = await getToken();
    const result = token ? await saveSettings(token, { weekStart: next }) : undefined;
    if (!result || result.error) {
      setWeekStart(previous);
      toast.error(copy.profile.weekStartError);
    }
  };

  return (
    <SegmentedControl
      aria-label={copy.profile.weekStartTitle}
      value={String(weekStart)}
      onValueChange={(value) => void choose(value)}
      options={copy.form.repeatDays.map((day, index) => ({ value: String(index), label: day }))}
    />
  );
}
