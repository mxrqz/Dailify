import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

let role: "free" | "pro" | "max" = "free";
let userId = "vu1";

const { openaiMock } = vi.hoisted(() => {
  const openaiMock = {
    audio: { transcriptions: { create: vi.fn() } },
    responses: { create: vi.fn() },
  };
  return { openaiMock };
});

vi.mock("openai", () => {
  function MockOpenAI() {
    return openaiMock;
  }
  return { default: MockOpenAI };
});

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: userId, plan: role }));

import { DateTime } from "luxon";
import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { getTask } from "../src/db/tasks";
import { saveSettings } from "../src/db/settings";
import { limitsFor, type Task } from "@dailify/shared";
import { bumpStoredUsage, periodFor, readStoredUsage } from "../src/db/usage";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  vi.clearAllMocks();
  // Sem fuso no form, a voz cai no `user_settings.time_zone`.
  await saveSettings(env.DB, "vu1", { timeZone: "UTC" });
});

function audioRequest(timezone?: string) {
  const form = new FormData();
  form.append("audio", new File([new Uint8Array([1, 2, 3])], "audio.ogg", { type: "audio/ogg" }));
  if (timezone) form.append("timezone", timezone);
  return app.request("/tasks/voice", { method: "POST", body: form }, env);
}

describe("POST /tasks/voice", () => {
  it("transcribes, creates tasks, and returns epoch-ms dates for a max role", async () => {
    role = "max";
    openaiMock.audio.transcriptions.create.mockResolvedValue({
      text: "Adiciona reunião com o time amanhã às 14h e almoço às 12h",
    });
    openaiMock.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        intent: "create",
        reply: "Anotei as duas!",
        tasks: [
          {
            title: "Reunião com o time",
            duration: "30min",
            repeat: "Off",
            date: "2026-08-03T14:00:00",
            links: [],
          },
          {
            title: "Almoço",
            duration: "1h",
            repeat: "Off",
            date: "2026-08-03T12:00:00",
            links: [],
          },
        ],
      }),
    });

    const res = await audioRequest();
    expect(res.status).toBe(200);
    const body = await res.json<{ response: string; tasks: Task[] }>();
    expect(body.tasks).toHaveLength(2);

    const [meeting, lunch] = body.tasks;
    expect(typeof meeting.date).toBe("number");
    expect(meeting.date).toBe(Date.UTC(2026, 7, 3, 14, 0, 0));
    expect(body.response).toBe("Anotei as duas!");
    // Sem alerta nem prioridade inventados; duração no formato do Task.
    expect(meeting).toMatchObject({ priority: 0, duration: "30m" });
    expect(meeting.alert).toBeUndefined();
    expect(lunch.date).toBe(Date.UTC(2026, 7, 3, 12, 0, 0));
    expect(await readStoredUsage(env.DB, "vu1", "ai", periodFor(new Date()))).toBe(1);

    const saved = await getTask(env.DB, "vu1", meeting.id);
    expect(saved).toMatchObject({ title: "Reunião com o time", date: meeting.date });
  });

  it("transcribes with the successor of gpt-4o-mini-transcribe", async () => {
    role = "max";
    userId = "vu-model";
    openaiMock.audio.transcriptions.create.mockResolvedValue({ text: "comprar pão amanhã" });
    await audioRequest("UTC");
    expect(openaiMock.audio.transcriptions.create.mock.calls[0][0]).toMatchObject({
      model: "gpt-transcribe",
    });
  });

  it("reinterprets GPT's naive-local dates using the user's non-UTC timezone (America/Sao_Paulo, UTC-3)", async () => {
    role = "max";
    userId = "vu3";
    await saveSettings(env.DB, "vu3", { timeZone: "America/Sao_Paulo" });
    // Duas tarefas numa frase: o parser local fica em dúvida e o GPT lê.
    openaiMock.audio.transcriptions.create.mockResolvedValue({
      text: "reunião às 14h e almoço às 12h",
    });
    openaiMock.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        intent: "create",
        reply: "Marquei!",
        // Naive local (no 'Z', no offset) — GPT reasons entirely in the user's local time.
        tasks: [
          {
            title: "Reunião",
            duration: null,
            repeat: "Off",
            date: "2026-08-03T14:00:00",
            links: [],
          },
        ],
      }),
    });

    const res = await audioRequest();
    expect(res.status).toBe(200);
    const body = await res.json<{ response: string; tasks: Task[] }>();
    expect(body.tasks).toHaveLength(1);

    // 14:00 BRT (UTC-3, no DST since 2019) === 17:00 UTC. A no-op conversion (interpreting the
    // naive string as literal UTC) would wrongly yield Date.UTC(2026, 7, 3, 14, 0, 0) here.
    expect(body.tasks[0].date).toBe(Date.UTC(2026, 7, 3, 17, 0, 0));
    expect(openaiMock.responses.create).toHaveBeenCalledOnce();
    expect(await readStoredUsage(env.DB, "vu3", "ai", periodFor(new Date()))).toBe(1);
  });

  it.each([
    ["vl1", "America/Sao_Paulo"],
    ["vl2", "Asia/Tokyo"],
  ])(
    "frase clara: o parser local lê no fuso do cliente, sem GPT, e cobra 1 crédito (%s)",
    async (id, tz) => {
      role = "max";
      userId = id;
      openaiMock.audio.transcriptions.create.mockResolvedValue({ text: "dentista amanhã às 15h" });

      const res = await audioRequest(tz);
      expect(res.status).toBe(200);
      const body = await res.json<{ response: string; tasks: Task[] }>();
      const tomorrow15 = DateTime.now()
        .setZone(tz)
        .plus({ days: 1 })
        .set({ hour: 15, minute: 0, second: 0, millisecond: 0 });
      expect(body.tasks).toHaveLength(1);
      expect(body.tasks[0]).toMatchObject({
        title: "dentista",
        date: tomorrow15.toMillis(),
        duration: "10m",
      });
      expect(body.tasks[0].undated).toBeUndefined();
      expect(openaiMock.responses.create).not.toHaveBeenCalled();
      expect(await readStoredUsage(env.DB, id, "ai", periodFor(new Date()))).toBe(1);
    },
  );

  it("does not insert tasks for a non-create ('invalid') AI response", async () => {
    role = "max";
    userId = "vu2";
    await saveSettings(env.DB, "vu2", { timeZone: "UTC" });
    openaiMock.audio.transcriptions.create.mockResolvedValue({
      text: "quantos dias faltam pro natal?",
    });
    openaiMock.responses.create.mockResolvedValue({
      output_text: JSON.stringify({ intent: "unsupported", reply: "Só anoto tarefas.", tasks: [] }),
    });

    const res = await audioRequest();
    expect(res.status).toBe(200);
    const body = await res.json<{ response: string; tasks: Task[] }>();
    expect(body.tasks).toEqual([]);

    const row = await env.DB.prepare("SELECT COUNT(*) as n FROM tasks WHERE user_id=?")
      .bind("vu2")
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it("413s an oversized audio upload before calling OpenAI", async () => {
    role = "max";
    userId = "vu4";
    const form = new FormData();
    form.append(
      "audio",
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.ogg", { type: "audio/ogg" }),
    );
    const res = await app.request("/tasks/voice", { method: "POST", body: form }, env);
    expect(res.status).toBe(413);
    expect(openaiMock.audio.transcriptions.create).not.toHaveBeenCalled();
  });
});

describe("POST /tasks/voice — quota e tamanho", () => {
  it("recusa áudio acima de 512 KB sem chamar a OpenAI", async () => {
    role = "max";
    userId = "vq1";
    const form = new FormData();
    form.append(
      "audio",
      new File([new Uint8Array(512 * 1024 + 1)], "audio.ogg", { type: "audio/ogg" }),
    );
    const res = await app.request("/tasks/voice", { method: "POST", body: form }, env);
    expect(res.status).toBe(413);
    expect(openaiMock.audio.transcriptions.create).not.toHaveBeenCalled();
  });

  it("429s quando os créditos de IA do mês acabaram", async () => {
    role = "free";
    userId = "vq2";
    await saveSettings(env.DB, "vq2", { timeZone: "UTC" });
    for (let i = 0; i < limitsFor("free").ai; i++) {
      await bumpStoredUsage(env.DB, "vq2", "ai", periodFor(new Date()));
    }
    const res = await audioRequest();
    expect(res.status).toBe(429);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("AI Credits Limit Reached");
    expect(openaiMock.audio.transcriptions.create).not.toHaveBeenCalled();
  });

  it("gasta o crédito mesmo quando a geração não cria tarefa", async () => {
    role = "free";
    userId = "vq3";
    await saveSettings(env.DB, "vq3", { timeZone: "UTC" });
    openaiMock.audio.transcriptions.create.mockResolvedValue({ text: "quais sao minhas tarefas" });
    openaiMock.responses.create.mockResolvedValue({
      output_text: JSON.stringify({ intent: "question", reply: "ok", tasks: [] }),
    });

    const res = await audioRequest();
    expect(res.status).toBe(200);
    const period = periodFor(new Date());
    expect(await readStoredUsage(env.DB, "vq3", "ai", period)).toBe(1);
  });

  it("não gasta crédito quando a transcrição falha", async () => {
    role = "free";
    userId = "vq4";
    await saveSettings(env.DB, "vq4", { timeZone: "UTC" });
    openaiMock.audio.transcriptions.create.mockRejectedValue(new Error("boom"));

    const res = await audioRequest();
    expect(res.status).toBe(502);
    expect(openaiMock.responses.create).not.toHaveBeenCalled();
    expect(await readStoredUsage(env.DB, "vq4", "ai", periodFor(new Date()))).toBe(0);
  });

  it("dia sem hora vira Sem data com lembrete às 09:00 locais", async () => {
    role = "max";
    userId = "vq5";
    await saveSettings(env.DB, "vq5", { timeZone: "UTC" });
    openaiMock.audio.transcriptions.create.mockResolvedValue({ text: "pagar luz dia 3 ou dia 4" });
    openaiMock.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        intent: "create",
        reply: "Anotei!",
        tasks: [
          { title: "Pagar luz", date: "2099-08-03", duration: null, repeat: "Off", links: [] },
        ],
      }),
    });

    const res = await audioRequest();
    const [task] = (await res.json<{ tasks: Task[] }>()).tasks;
    const nine = Date.UTC(2099, 7, 3, 9);
    expect(task).toMatchObject({ undated: true, date: nine, alert: nine, duration: "10m" });
  });
});
