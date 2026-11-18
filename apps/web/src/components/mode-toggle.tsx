import { SegmentedControl } from "@/components/kit/segmented-control";
import { useTheme } from "./theme-provider";
import { copy } from "@/components/dashboard/copy";

/** Seletor de tema em linha, pra dentro de `/settings`. */
export function ThemeSelect(): JSX.Element {
  const { theme, setTheme } = useTheme();

  return (
    <SegmentedControl
      aria-label={copy.profile.themeTitle}
      value={theme}
      onValueChange={setTheme}
      options={[
        { value: "light", label: copy.header.themeLight },
        { value: "dark", label: copy.header.themeDark },
        { value: "system", label: copy.header.themeSystem },
      ]}
    />
  );
}
