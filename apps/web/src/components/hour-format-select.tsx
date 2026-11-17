import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { saveSettings } from "@/functions/api";

/** 24h ou 12h (AM/PM) em todo horário do app. Otimista, como o início da semana. */
export function HourFormatSelect(): JSX.Element {
  const { hour12, setHour12 } = useDailify();

  const choose = async (value: "24" | "12") => {
    const next = value === "12";
    if (next === hour12) return;
    setHour12(next);
    const result = await saveSettings({ hour12: next });
    if (result.error) {
      setHour12(!next);
      toast.error(copy.profile.hourFormatError);
    }
  };

  return (
    <SegmentedControl
      aria-label={copy.profile.hourFormatTitle}
      className="w-32 flex-none"
      value={hour12 ? "12" : "24"}
      onValueChange={(value) => void choose(value)}
      options={[
        { value: "24", label: copy.profile.hour24 },
        { value: "12", label: copy.profile.hour12 },
      ]}
    />
  );
}
