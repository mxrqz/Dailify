import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const TOASTER_THEMES: readonly string[] = ["light", "dark", "system"];
const isToasterTheme = (value: unknown): value is ToasterProps["theme"] =>
  typeof value === "string" && TOASTER_THEMES.includes(value);

// Interseção com Record: CSSProperties sozinho não aceita custom properties.
const toasterTokens: React.CSSProperties & Record<string, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={isToasterTheme(theme) ? theme : undefined}
      className="toaster group"
      style={toasterTokens}
      {...props}
    />
  );
};

export { Toaster };
