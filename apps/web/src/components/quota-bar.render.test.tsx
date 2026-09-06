/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { limitsFor, QUOTA_KEYS, type QuotaUsage } from "@dailify/shared";

const { dailify } = vi.hoisted(() => ({ dailify: vi.fn() }));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));

import { QuotaBar } from "./quota-bar";
import { TooltipProvider } from "@/components/ui/tooltip";

const NO_USAGE: QuotaUsage = { tasks: 0, recurring: 0, voice: 0 };

const renderBar = (role: "free" | "pro+ai") => {
  dailify.mockReturnValue({ quotas: { limits: limitsFor(role), usage: NO_USAGE }, tasks: [] });
  return render(
    <MemoryRouter>
      <TooltipProvider>
        <QuotaBar />
      </TooltipProvider>
    </MemoryRouter>,
  );
};

const heights = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-slot="quota-fill"]')).map(
    (el) => el.style.height,
  );

describe("<QuotaBar>", () => {
  /**
   * O bug: `tasks` e `recurring` do Pro + AI sao ilimitados, e a pilha desenhava os dois vazios —
   * numa bateria, vazio significa acabou, exatamente o contrario de nao ter teto.
   */
  it("desenha a pilha cheia no ilimitado, nao vazia", () => {
    const { container } = renderBar("pro+ai");

    const [tasks, recurring, voice] = heights(container);
    expect(tasks).toBe("100%");
    expect(recurring).toBe("100%");
    // voz tem teto de 200 no Pro + AI, entao segue a regra normal e comeca vazia
    expect(voice).toBe("0%");
  });

  it("quota com teto e sem uso continua vazia", () => {
    const { container } = renderBar("free");

    expect(heights(container)).toEqual(QUOTA_KEYS.map(() => "0%"));
  });
});
