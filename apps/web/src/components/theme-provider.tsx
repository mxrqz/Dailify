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
    try {
      const stored = localStorage.getItem(storageKey);
      return isTheme(stored) ? stored : defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;

    const apply = (value: Theme) => {
      // Sem pausar as transições, tudo com `transition-colors` anima entre os temas e a borda pisca.
      const pause = document.createElement("style");
      pause.textContent = "*,*::before,*::after{transition:none!important}";
      document.head.appendChild(pause);
      root.classList.remove("light", "dark");
      root.classList.add(
        value === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : value,
      );
      // Força o recálculo com o tema novo antes de devolver as transições.
      void getComputedStyle(root).colorScheme;
      setTimeout(() => pause.remove(), 1);
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
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // sem storage (aba privada) o tema vale só a sessão
      }
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

// No guard: the context has a default, so the Toaster also renders in tests without a provider.
export const useTheme = () => useContext(ThemeProviderContext);
