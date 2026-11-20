/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AnimatePresence } from "motion/react";

import { Splash } from "./splash";

const app = (splash: boolean) => (
  <AnimatePresence>{splash && <Splash key="splash" />}</AnimatePresence>
);

describe("Splash", () => {
  // The harness's WAAPI stub never calls `onfinish`, which is what motion waits on to resolve.
  beforeEach(() => {
    const finish = Element.prototype.animate;
    vi.spyOn(Element.prototype, "animate").mockImplementation(function (
      this: Element,
      ...args: Parameters<Element["animate"]>
    ) {
      const animation = finish.apply(this, args);
      Object.defineProperty(animation, "onfinish", {
        set: (done: () => void) => setTimeout(done),
      });
      return animation;
    });
  });

  it("fades out and unmounts when no dock Mew is mounted", async () => {
    const view = render(app(true));
    expect(view.getByRole("status")).toBeInTheDocument();
    view.rerender(app(false));
    await waitFor(() => expect(view.queryByRole("status")).toBeNull());
  });

  it("flies the Mew to the dock Mew, then unmounts", async () => {
    const view = render(
      <>
        <div data-slot="create-dock">
          <div className="mew" />
        </div>
        {app(true)}
      </>,
    );
    const rect = (left: number, top: number, size: number) =>
      DOMRect.fromRect({ x: left, y: top, width: size, height: size });
    const dock = view.container.querySelector(".mew");
    const mew = view.getByRole("status").previousElementSibling;
    if (!dock || !(mew instanceof HTMLElement)) throw new Error("missing nodes");
    dock.getBoundingClientRect = () => rect(20, 700, 28);
    mew.getBoundingClientRect = () => rect(100, 300, 168);

    view.rerender(
      <>
        <div data-slot="create-dock">
          <div className="mew" />
        </div>
        {app(false)}
      </>,
    );
    await waitFor(() => expect(mew.style.transform).toContain("scale"));
    await waitFor(() => expect(view.queryByRole("status")).toBeNull());
  });
});
