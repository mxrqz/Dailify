import { describe, test, expect } from "vitest";
import { PLAN_ID, planMap } from "./conts";

describe("plan ids", () => {
  test("every PLAN_ID value is a key in planMap", () => {
    for (const id of Object.values(PLAN_ID)) {
      expect(Object.keys(planMap)).toContain(id);
    }
  });
});
