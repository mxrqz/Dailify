import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

import { useMediaQuery } from "@/hooks/useMediaQuery";

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
  // No mobile o rodapé é do polegar, do composer e da nav — o toast lá cobre justamente o que a
  // pessoa acabou de tocar.
  const mobile = useMediaQuery("(max-width: 767px)");

  return (
    <Sonner
      position={mobile ? "top-center" : "bottom-right"}
      theme={isToasterTheme(theme) ? theme : undefined}
      className="toaster group"
      style={toasterTokens}
      {...props}
    />
  );
};

export { Toaster };
