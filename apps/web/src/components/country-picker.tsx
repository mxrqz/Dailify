import { useState } from "react";
import { Check } from "lucide-react";
import * as countriesLib from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

countriesLib.registerLocale(enLocale);

// Ordenado uma vez aqui: os seletores chamavam `.sort()` no render, mutando esta constante a cada
// repintura.
export const countries = getCountries()
  .map((code) => ({
    code,
    name: countriesLib.getName(code, "en") ?? code,
    dialCode: `+${getCountryCallingCode(code)}`,
  }))
  .sort((a, b) => Number(a.dialCode.replace("+", "")) - Number(b.dialCode.replace("+", "")));

export function getFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

/**
 * Combobox de país que mostra o DDI. Cada instância tem seu próprio `open` — as duas cópias que
 * isto substituiu dividiam um state só, então abrir uma abriria a outra se aparecessem juntas.
 */
export function CountryPicker({
  value,
  onChange,
  defaultValue,
}: {
  value: string;
  onChange: (countryName: string) => void;
  defaultValue?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-fit p-0 px-2"
        >
          {value ? countries.find((country) => country.name === value)?.dialCode : "+55"}
        </Button>
      </PopoverTrigger>

      <PopoverContent>
        <Command defaultValue={defaultValue ?? value}>
          <CommandInput />

          <CommandList className="scroll-py-0">
            <CommandEmpty>Country not found</CommandEmpty>

            <CommandGroup>
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  className="flex gap-2"
                  value={country.name}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <span>{getFlagEmoji(country.code)}</span>
                  <span className="text-muted-foreground">{country.dialCode}</span>
                  <span>{country.name}</span>
                  <Check
                    className={cn("ml-auto", value === country.code ? "opacity-100" : "opacity-0")}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
