import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { segmented, segmentedItem } from "@/components/settings-list";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { saveSettings } from "@/functions/api";

/** 24h ou 12h (AM/PM) em todo horário do app. Otimista, como o início da semana. */
export function HourFormatSelect(): JSX.Element {
  const { hour12, setHour12 } = useDailify();
  const { getToken } = useAuth();

  const choose = async (value: string) => {
    // Clicar no item ativo emite "": não é troca nenhuma.
    if (value === "") return;
    const next = value === "12";
    if (next === hour12) return;
    setHour12(next);
    const token = await getToken();
    const result = token ? await saveSettings(token, { hour12: next }) : undefined;
    if (!result || result.error) {
      setHour12(!next);
      toast.error(copy.profile.hourFormatError);
    }
  };

  return (
    <ToggleGroup
      type="single"
      className={segmented}
      value={hour12 ? "12" : "24"}
      onValueChange={(value) => void choose(value)}
      aria-label={copy.profile.hourFormatTitle}
    >
      <ToggleGroupItem className={segmentedItem} value="24">
        {copy.profile.hour24}
      </ToggleGroupItem>
      <ToggleGroupItem className={segmentedItem} value="12">
        {copy.profile.hour12}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
