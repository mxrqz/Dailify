import { useAuth } from "@clerk/clerk-react";
import { isWeekStart } from "@dailify/shared";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { saveSettings } from "@/functions/api";

/** Otimista: aplica já e volta ao anterior se a API falhar. */
export function WeekStartSelect(): JSX.Element {
  const { weekStart, setWeekStart } = useDailify();
  const { getToken } = useAuth();

  const choose = async (value: string) => {
    // Clicar no item ativo emite "": Number("") é 0 e viraria domingo sem querer.
    const next = value === "" ? undefined : Number(value);
    if (!isWeekStart(next)) return;
    const previous = weekStart;
    setWeekStart(next);
    const token = await getToken();
    const result = token ? await saveSettings(token, next) : undefined;
    if (!result || result.error) {
      setWeekStart(previous);
      toast.error(copy.profile.weekStartError);
    }
  };

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={String(weekStart)}
      onValueChange={choose}
      aria-label={copy.profile.weekStartTitle}
    >
      {copy.form.repeatDays.map((day, index) => (
        <ToggleGroupItem key={day} value={String(index)}>
          {day}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
