import { describe, it, expect } from "vitest";
import { API_ERROR, isApiErrorCode } from "./errors";

describe("isApiErrorCode", () => {
  it("accepts every registered code and rejects anything else", () => {
    for (const code of Object.values(API_ERROR)) expect(isApiErrorCode(code)).toBe(true);
    for (const value of ["toString", "rateLimited", "", 429, undefined])
      expect(isApiErrorCode(value)).toBe(false);
  });
});
