import { vi } from "vitest";

/**
 * The `openai` module mock: every `new OpenAI()` is this one object.
 *   vi.mock("openai", () => import("./openai"));
 *   import { openaiMock } from "./openai";
 */
export const openaiMock = {
  audio: { transcriptions: { create: vi.fn() } },
  responses: { create: vi.fn() },
};

function MockOpenAI() {
  return openaiMock;
}

export default MockOpenAI;
