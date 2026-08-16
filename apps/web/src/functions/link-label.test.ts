import { describe, expect, it } from "vitest";
import { linkLabel } from "./link-label";

describe("linkLabel", () => {
  it.each([
    ["https://meet.google.com/abc", "Google Meet"],
    ["https://youtu.be/xyz", "YouTube"],
    ["https://www.youtube.com/watch?v=1", "YouTube"],
    ["https://dailify.mxrqz.com/x", "dailify.mxrqz.com"],
    ["https://www.exemplo.com", "exemplo.com"],
  ])("%s → %s", (url, expected) => {
    expect(linkLabel(url)).toBe(expected);
  });

  it("url quebrada volta ela mesma em vez de estourar", () => {
    expect(linkLabel("não é url")).toBe("não é url");
  });
});
