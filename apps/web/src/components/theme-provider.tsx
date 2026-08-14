import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

const THEMES: readonly string[] = ["dark", "light", "system"];
export const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && THEMES.includes(value);

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(storageKey);
    return isTheme(stored) ? stored : defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;

    const apply = (value: Theme) => {
      root.classList.remove("light", "dark");
      root.classList.add(
        value === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : value,
      );
    };

    apply(theme);

    if (theme !== "system") return;

    // Sem este listener, quem está em "system" só acompanha o modo noturno do SO após um reload.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
