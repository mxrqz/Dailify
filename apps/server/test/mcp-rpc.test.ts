import { describe, expect, it, vi } from "vitest";
import { handleRpc, occurrenceOn, type ToolResult } from "../src/lib/mcp";
import { makeTask } from "@dailify/shared/testing";
import { zonedEpoch } from "@dailify/shared";

const ok: ToolResult = { content: [{ type: "text", text: "hi" }] };
const run = (msg: unknown) =>
  handleRpc(typeof msg === "string" ? msg : JSON.stringify(msg), async () => ok, "1");

describe("handleRpc", () => {
  it("maps malformed messages to JSON-RPC errors with a 400", async () => {
    expect(await run("{")).toMatchObject({ status: 400, body: { error: { code: -32700 } } });
    expect(await run([{ jsonrpc: "2.0", id: 1, method: "ping" }])).toMatchObject({
      status: 400,
      body: { error: { code: -32600 } },
    });
    expect(await run({ id: 1, method: "ping" })).toMatchObject({ status: 400 });
  });

  it("acknowledges notifications and responses with an empty 202", async () => {
    expect(await run({ jsonrpc: "2.0", method: "notifications/initialized" })).toEqual({
      status: 202,
    });
    expect(await run({ jsonrpc: "2.0", id: 3, result: {} })).toEqual({ status: 202 });
  });

  it("echoes a supported protocol version and falls back to the latest", async () => {
    const init = (protocolVersion: string) =>
      run({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion } });
    expect(await init("2025-03-26")).toMatchObject({
      body: { result: { protocolVersion: "2025-03-26" } },
    });
    expect(await init("2024-11-05")).toMatchObject({
      body: { result: { protocolVersion: "2025-11-25" } },
    });
  });

  it("answers ping, unknown methods and unknown tools", async () => {
    expect(await run({ jsonrpc: "2.0", id: "a", method: "ping" })).toEqual({
      status: 200,
      body: { jsonrpc: "2.0", id: "a", result: {} },
    });
    expect(await run({ jsonrpc: "2.0", id: 1, method: "resources/list" })).toMatchObject({
      body: { error: { code: -32601 } },
    });
    expect(
      await run({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "toString" } }),
    ).toMatchObject({ body: { error: { code: -32602 } } });
  });

  it("passes a known tool's arguments to the caller", async () => {
    const call = vi.fn(async () => ok);
    const msg = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "list_tasks", arguments: { from: "x" } },
    };
    expect(await handleRpc(JSON.stringify(msg), call, "1")).toMatchObject({ body: { result: ok } });
    expect(call).toHaveBeenCalledWith("list_tasks", { from: "x" });
  });
});

describe("occurrenceOn", () => {
  const zone = "America/Sao_Paulo";
  const at = (day: number) =>
    zonedEpoch({ year: 2026, month: 11, day, hour: 9, minute: 0, second: 0 }, zone);
  const weekly = makeTask({ date: at(1), repeat: { Weekly: ["Tuesday"] }, exdates: [at(8)] });

  it("finds the anchor and later instances, skipping excluded days and off days", () => {
    expect(occurrenceOn(weekly, "2026-12-01", zone)).toBe(at(1));
    expect(occurrenceOn(weekly, "2026-12-15", zone)).toBe(at(15));
    expect(occurrenceOn(weekly, "2026-12-08", zone)).toBeNull();
    expect(occurrenceOn(weekly, "2026-12-02", zone)).toBeNull();
  });
});
