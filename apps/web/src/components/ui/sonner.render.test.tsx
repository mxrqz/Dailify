/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";

import { Toaster } from "./sonner";
import { ThemeProvider, useTheme } from "@/components/theme-provider";

const GoDark = () => {
  const { setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme("dark")}>
      escuro
    </button>
  );
};

describe("<Toaster>", () => {
  // Com o next-themes sem provider, o toast ficava em "system" (claro aqui) com o app em dark.
  it("acompanha o tema do ThemeProvider do app", async () => {
    localStorage.setItem("vite-ui-theme", "light");
    render(
      <ThemeProvider>
        <GoDark />
        <Toaster />
      </ThemeProvider>,
    );
    act(() => void toast("Salvo", { description: "agora" }));
    const toaster = (await screen.findByText("Salvo")).closest("[data-sonner-toaster]");
    expect(toaster).toHaveAttribute("data-sonner-theme", "light");

    act(() => screen.getByRole("button", { name: "escuro" }).click());

    expect(toaster).toHaveAttribute("data-sonner-theme", "dark");
    expect(screen.getByText("agora")).toHaveClass("text-ink-secondary!");
  });
});
