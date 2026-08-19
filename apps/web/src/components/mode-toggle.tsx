import { Moon, Sun } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isTheme, useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";
import { copy } from "@/components/dashboard/copy";

/** Versão de barra, usada só pelo header da landing — no app o tema mora em Configurações. */
export function ModeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "cursor-pointer size-9 border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
      >
        <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">{copy.header.themeToggle}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(isTheme(v) ? v : "system")}
        >
          <DropdownMenuRadioItem value="light">{copy.header.themeLight}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{copy.header.themeDark}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{copy.header.themeSystem}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Seletor de tema em linha, pra dentro de `/settings`. O guard do `isTheme` não é
 * decoração: clicar no item já ativo faz o Radix emitir `""`, que sem ele zeraria o tema.
 */
export function ThemeSelect(): JSX.Element {
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={theme}
      onValueChange={(value) => {
        if (isTheme(value)) setTheme(value);
      }}
      aria-label={copy.header.themeToggle}
    >
      <ToggleGroupItem value="light">{copy.header.themeLight}</ToggleGroupItem>
      <ToggleGroupItem value="dark">{copy.header.themeDark}</ToggleGroupItem>
      <ToggleGroupItem value="system">{copy.header.themeSystem}</ToggleGroupItem>
    </ToggleGroup>
  );
}
