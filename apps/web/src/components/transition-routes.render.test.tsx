/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, useNavigate } from "react-router-dom";

import { TransitionRoutes } from "./transition-routes";

let go: ReturnType<typeof useNavigate>;
function Nav(): null {
  go = useNavigate();
  return null;
}

const mount = () =>
  render(
    <MemoryRouter initialEntries={["/a"]}>
      <Nav />
      <TransitionRoutes>
        <Route path="/a" element={<p>page a</p>} />
        <Route path="/b" element={<p>page b</p>} />
      </TransitionRoutes>
    </MemoryRouter>,
  );

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
});

describe("<TransitionRoutes>", () => {
  it("cross-fades a page change through startViewTransition, not a query change", async () => {
    const start = vi.fn((update: () => Promise<void>) => {
      void update();
      return { ready: Promise.resolve() };
    });
    Object.defineProperty(document, "startViewTransition", { value: start, configurable: true });
    mount();

    await act(async () => go("/a?view=calendar"));
    expect(start).not.toHaveBeenCalled();

    await act(async () => go("/b"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("page b")).toBeInTheDocument();
  });

  it("swaps at once without the API", async () => {
    mount();
    await act(async () => go("/b"));
    expect(screen.getByText("page b")).toBeInTheDocument();
  });
});
