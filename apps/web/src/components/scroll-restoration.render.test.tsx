/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate, type NavigateFunction } from "react-router-dom";

import { ScrollRestoration } from "./scroll-restoration";

describe("ScrollRestoration", () => {
  it("tops a new page, restores on back, ignores search-only changes", () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    let navigate: NavigateFunction = () => undefined;
    function Grab() {
      navigate = useNavigate();
      return null;
    }
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ScrollRestoration />
        <Grab />
      </MemoryRouter>,
    );
    const scrollAt = (y: number) => {
      Object.defineProperty(window, "scrollY", { value: y, configurable: true });
      window.dispatchEvent(new Event("scroll"));
    };

    scrollAt(800);
    act(() => void navigate("/dashboard?view=calendar"));
    expect(scrollTo).not.toHaveBeenCalled();
    act(() => void navigate(-1));
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => void navigate("/profile"));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    scrollAt(0);
    act(() => void navigate(-1));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 800);
    vi.unstubAllGlobals();
  });
});
