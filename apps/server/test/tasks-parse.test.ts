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

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: userId, plan: role }));

import { env, applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { limitsFor, type AiParse } from "@dailify/shared";
import { bumpStoredUsage, periodFor, readStoredUsage } from "../src/db/usage";
import { markRevoked, upsertConnection } from "../src/db/integrations";
import { toEpoch } from "../src/lib/openai";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(() => {
  vi.clearAllMocks();
  role = "free";
});

const used = (id: string) => readStoredUsage(env.DB, id, "ai", periodFor(new Date()));

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

describe("POST /tasks/parse — repeatEvery", () => {
  it("passa o N da IA e descarta o que não cabe", async () => {
    userId = "pu-every";
    aiReturns({
      intent: "create",
      reply: "Anotei!",
      tasks: [
        task({ title: "Faxina", repeat: { Weekly: ["Monday"] }, repeatEvery: 2 }),
        task({ title: "Avulsa", repeatEvery: 3 }),
        task({ title: "Lixo", repeat: "Daily", repeatEvery: 9999 }),
      ],
    });
    const res = await parse({ text: "faxina a cada 2 semanas", timezone: "UTC" });
    const { drafts } = await res.json<AiParse>();
    expect(drafts.map((d) => d.repeatEvery)).toEqual([2, undefined, undefined]);
  });
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
      await bumpStoredUsage(env.DB, "pu3", "ai", periodFor(new Date()));
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

describe("POST /tasks/parse — targets", () => {
  const connect = (id: string) =>
    upsertConnection(
      env.DB,
      id,
      "google-calendar",
      { accountId: "g1", email: null, scopes: "", tokens: "v1.x.y" },
      Date.now(),
    );
  type Sent = { instructions: string; text: { format: { schema: unknown } } };
  const sent = (): Sent => openaiMock.responses.create.mock.calls[0][0];
  const targetsSchema = () =>
    JSON.parse(JSON.stringify(sent().text.format.schema)).properties.tasks.items.properties.targets;

  it("usa o modelo sucessor do gpt-4o-mini e não deixa a OpenAI guardar o pedido", async () => {
    userId = "pt-model";
    aiReturns({ intent: "create", reply: "ok", tasks: [task({ targets: [] })] });
    await parse({ text: "x", timezone: "UTC" });
    expect(sent()).toMatchObject({
      model: "gpt-6-luna",
      store: false,
      reasoning: { effort: "low" },
    });
  });

  it("sem conexão: o schema só aceita [] e um target inventado cai", async () => {
    userId = "pt-none";
    aiReturns({
      intent: "create",
      reply: "ok",
      tasks: [task({ targets: [{ provider: "google-calendar", meet: true }] })],
    });
    const { drafts } = await (await parse({ text: "x", timezone: "UTC" })).json<AiParse>();
    expect(targetsSchema().maxItems).toBe(0);
    expect(sent().instructions).toContain("nenhum app conectado");
    expect(drafts[0].targets).toBeUndefined();
  });

  it("conexão revogada não entra", async () => {
    userId = "pt-revoked";
    await connect(userId);
    await markRevoked(env.DB, userId, "google-calendar", Date.now());
    aiReturns({ intent: "create", reply: "ok", tasks: [task({ targets: [] })] });
    await parse({ text: "x", timezone: "UTC" });
    expect(targetsSchema().maxItems).toBe(0);
  });

  it("conectada: enum no schema, nome no prompt, target válido passa e o resto cai", async () => {
    userId = "pt-on";
    await connect(userId);
    aiReturns({
      intent: "create",
      reply: "ok",
      tasks: [
        task({ title: "Call", targets: [{ provider: "google-calendar", meet: true }] }),
        task({ title: "Sem", targets: [{ provider: "slack", meet: false }] }),
        task({ title: "Plain", targets: [{ provider: "google-calendar", meet: false }] }),
      ],
    });
    const res = await parse({ text: "call amanhã, coloca no Google Agenda", timezone: "UTC" });
    const { drafts } = await res.json<AiParse>();
    expect(targetsSchema().maxItems).toBe(1);
    expect(targetsSchema().items.properties.provider.enum).toEqual(["google-calendar"]);
    expect(sent().instructions).toContain("Integrações conectadas: Google Agenda");
    expect(drafts.map((d) => d.targets)).toEqual([
      [{ provider: "google-calendar", meet: true }],
      undefined,
      [{ provider: "google-calendar" }],
    ]);
    expect(await used(userId)).toBe(1);
  });

  it("target com shape errado → 502 sem débito", async () => {
    userId = "pt-bad";
    aiReturns({
      intent: "create",
      reply: "ok",
      tasks: [task({ targets: [{ provider: "google-calendar", meet: "sim" }] })],
    });
    expect((await parse({ text: "x", timezone: "UTC" })).status).toBe(502);
    expect(await used(userId)).toBe(0);
  });
});

describe("toEpoch", () => {
  it("reads wall time in the client zone and drops a stray offset", () => {
    const at = Date.UTC(2026, 6, 10, 17, 30);
    expect(toEpoch("2026-07-10T14:30:00", "America/Sao_Paulo")).toBe(at);
    expect(toEpoch("2026-07-10T14:30Z", "America/Sao_Paulo")).toBe(at);
    expect(toEpoch("2026-07-10", "America/Sao_Paulo")).toBe(Date.UTC(2026, 6, 10, 3));
  });

  it("rejects dates that don't exist or fall outside DATE_RANGE", () => {
    expect(toEpoch("2026-02-30", "UTC")).toBeNull();
    expect(toEpoch("2026-07-10T25:00", "UTC")).toBeNull();
    expect(toEpoch("amanhã", "UTC")).toBeNull();
    expect(toEpoch("1999-12-31", "UTC")).toBeNull();
  });
});
