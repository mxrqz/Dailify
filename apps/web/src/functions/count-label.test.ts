import { describe, expect, it } from "vitest";

import { countLabel } from "./count-label";

describe("countLabel", () => {
  it("uses the singular only for one", () => {
    expect(countLabel(1, "1 item", "{n} itens")).toBe("1 item");
    expect(countLabel(0, "1 item", "{n} itens")).toBe("0 itens");
    expect(countLabel(3, "1 item", "{n} itens")).toBe("3 itens");
  });
});
