import { useMemo, useState } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { ListRow } from "@/components/kit/list";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { saveSettings } from "@/functions/api";
import { deviceTimeZone } from "@/functions/zone";
import { cn } from "@/lib/utils";

const AUTO = "auto";

/** "GMT-3" do fuso agora — o que a pessoa reconhece mais rápido que o nome da cidade. */
function offsetOf(zone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
    .formatToParts(new Date())
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

/**
 * A linha "Fuso horário" de /settings, que abre a busca. "Automático" segue o aparelho (e viaja
 * com ele); escolher fixa um. Otimista.
 */
export function TimeZoneSelect(): JSX.Element {
  const { timeZone, setTimeZone } = useDailify();
  const [open, setOpen] = useState(false);
  const device = deviceTimeZone();
  const zones = useMemo(
    () => Intl.supportedValuesOf("timeZone").map((zone) => ({ zone, offset: offsetOf(zone) })),
    [],
  );

  const choose = async (next: string | null) => {
    setOpen(false);
    if (next === timeZone) return;
    const previous = timeZone;
    setTimeZone(next);
    const result = await saveSettings({ timeZone: next });
    if (result.error) {
      setTimeZone(previous);
      toast.error(copy.profile.timeZoneError);
    }
  };

  const label = timeZone ?? copy.profile.timeZoneAuto.replace("{zone}", device);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ListRow label={copy.profile.timeZoneTitle} sublabel={label} accessory="chevron" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder={copy.profile.timeZoneSearch} />
          <CommandList>
            <CommandEmpty>{copy.profile.timeZoneEmpty}</CommandEmpty>
            <CommandItem value={`${AUTO} ${device}`} onSelect={() => void choose(null)}>
              <CheckIcon className={cn("size-4", timeZone !== null && "invisible")} />
              {copy.profile.timeZoneAuto.replace("{zone}", device)}
            </CommandItem>
            {zones.map(({ zone, offset }) => (
              <CommandItem
                key={zone}
                value={`${zone} ${offset}`}
                onSelect={() => void choose(zone)}
              >
                <CheckIcon className={cn("size-4", timeZone !== zone && "invisible")} />
                <span className="flex-1 truncate">{zone.replace(/_/g, " ")}</span>
                <span className="font-mono text-2xs text-muted-foreground">{offset}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
