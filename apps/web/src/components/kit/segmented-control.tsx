import type { ReactNode } from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import { cn } from "@/lib/utils";

/**
 * Trilho em cápsula com o escolhido em `ink` (tema, formato de hora, início da semana). É um
 * radiogroup: setas andam entre as opções. Clicar no escolhido não emite nada — o Radix emitiria
 * `""`, e quem usa não precisa lembrar disso.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode }[];
  /** `w-32 flex-none` pra caber ao lado do rótulo (24h/12h); sem isso ocupa a largura toda. */
  className?: string;
  "aria-label": string;
}): JSX.Element {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      role="radiogroup"
      aria-label={ariaLabel}
      value={value}
      onValueChange={(next) => {
        const option = options.find((o) => o.value === next);
        if (option) onValueChange(option.value);
      }}
      className={cn("flex h-11 rounded-full bg-fill p-1", className)}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className="min-w-0 flex-1 cursor-pointer rounded-full px-1 text-subhead font-medium text-ink-secondary outline-none transition-colors duration-base hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=on]:bg-ink data-[state=on]:font-semibold data-[state=on]:text-canvas"
        >
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
