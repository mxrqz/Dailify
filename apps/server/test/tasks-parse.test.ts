import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

let role: "free" | "pro" | "max" = "free";
let userId = "pu1";

const { openaiMock } = vi.hoisted(() => ({
  openaiMock: { responses: { create: vi.fn() } },
}));

vi.mock("openai", () => {
  function MockOpenAI() {
    return openaiMock;
  }
  return { default: MockOpenAI };
});

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, getUserRole: vi.fn(async () => role) };
});

import { env, applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { limitsFor, type AiParse } from "@dailify/shared";
import { bumpStoredUsage, periodFor, readStoredUsage } from "../src/db/usage";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(() => {
  vi.clearAllMocks();
  role = "free";
});

const used = (id: string) => readStoredUsage(env.DB, id, "ai", periodFor("ai", new Date()));

function parse(body: unknown) {
  return app.request(
    "/tasks/parse",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );
}

function aiReturns(output: unknown) {
  openaiMock.responses.create.mockResolvedValue({
    output_text: JSON.stringify(output),
  });
}

const task = (over: Record<string, unknown>) => ({
  title: "Reunião",
  date: null,
  duration: null,
  repeat: "Off",
  links: [],
  ...over,
});

describe("POST /tasks/parse", () => {
  it("devolve rascunhos sem criar tarefa e debita exatamente 1 crédito", async () => {
    userId = "pu1";
    aiReturns({
      intent: "create",
      reply: "Anotei as duas!",
      tasks: [
        task({
          title: "Reunião com o time",
          date: "2026-08-03T14:00:00",
          duration: "1h30min",
          repeat: { Weekly: ["Monday", "Segunda"] },
          links: ["https://meet.google.com/abc", "javascript:alert(1)"],
        }),
        task({ title: "Pagar luz", date: "2026-08-04" }),
        task({ title: "Ler" }),
      ],
    });

    const res = await parse({
      text: "reunião toda segunda 14h e pagar luz amanhã",
      timezone: "America/Sao_Paulo",
    });
    expect(res.status).toBe(200);
    const body = await res.json<AiParse>();
    expect(body.intent).toBe("create");
    expect(body.reply).toBe("Anotei as duas!");
    expect(body.drafts).toEqual([
      {
        text: "Reunião com o time",
        // 14:00 em São Paulo (UTC-3) = 17:00 UTC: a hora ingênua é reinterpretada no fuso do cliente.
        date: Date.UTC(2026, 7, 3, 17),
        hasTime: true,
        hasDay: true,
        duration: "1h30m",
        links: ["https://meet.google.com/abc"],
        repeat: { Weekly: ["Monday"] },
      },
      {
        text: "Pagar luz",
        date: Date.UTC(2026, 7, 4, 3),
        hasTime: false,
        hasDay: true,
        duration: null,
        links: [],
        repeat: "Off",
      },
      {
        text: "Ler",
        date: null,
        hasTime: false,
        hasDay: false,
        duration: null,
        links: [],
        repeat: "Off",
      },
    ]);
    expect(await used("pu1")).toBe(1);
    const row = await env.DB.prepare("SELECT COUNT(*) as n FROM tasks WHERE user_id=?")
      .bind("pu1")
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it("pergunta ou pedido fora de escopo também gasta 1 crédito (a IA foi usada)", async () => {
    userId = "pu2";
    aiReturns({
      intent: "question",
      reply: "Por enquanto só anoto tarefas.",
      tasks: [task({})],
    });
    const res = await parse({ text: "o que tenho amanhã?", timezone: "UTC" });
    const body = await res.json<AiParse>();
    expect(body).toMatchObject({ intent: "question", drafts: [] });
    expect(await used("pu2")).toBe(1);
  });

  it("créditos esgotados → 429 sem chamar a OpenAI", async () => {
    userId = "pu3";
    for (let i = 0; i < limitsFor("free").ai; i++) {
      await bumpStoredUsage(env.DB, "pu3", "ai", periodFor("ai", new Date()));
    }
    const res = await parse({ text: "comprar pão", timezone: "UTC" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "AI Credits Limit Reached" });
    expect(openaiMock.responses.create).not.toHaveBeenCalled();
  });

  it("falha da OpenAI → 502 e nenhum débito", async () => {
    userId = "pu4";
    openaiMock.responses.create.mockRejectedValue(new Error("timeout"));
    const res = await parse({ text: "comprar pão", timezone: "UTC" });
    expect(res.status).toBe(502);
    expect(await used("pu4")).toBe(0);
  });

  it("resposta fora do contrato → 502 e nenhum débito", async () => {
    userId = "pu5";
    aiReturns({ response: "ok", type: "create", tasks: [] });
    expect((await parse({ text: "comprar pão", timezone: "UTC" })).status).toBe(502);
    aiReturns({
      intent: "create",
      reply: "ok",
      tasks: [task({ date: "amanhã" })],
    });
    expect((await parse({ text: "comprar pão", timezone: "UTC" })).status).toBe(502);
    expect(await used("pu5")).toBe(0);
  });

  it("valida texto e fuso antes de chamar a OpenAI", async () => {
    userId = "pu6";
    expect((await parse({ text: "", timezone: "UTC" })).status).toBe(400);
    expect((await parse({ text: "x".repeat(201), timezone: "UTC" })).status).toBe(400);
    expect((await parse({ text: "comprar pão", timezone: "Mars/Olympus" })).status).toBe(400);
    expect(openaiMock.responses.create).not.toHaveBeenCalled();
  });
});
