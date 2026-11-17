import { describe, expect, it } from "vitest";

import { startsSwipe } from "./swipe-actions";

describe("startsSwipe", () => {
  it("leaves 24px at each edge to the system back gesture", () => {
    expect(startsSwipe(16, 390)).toBe(false);
    expect(startsSwipe(24, 390)).toBe(false);
    expect(startsSwipe(25, 390)).toBe(true);
    expect(startsSwipe(366, 390)).toBe(false);
  });
});
