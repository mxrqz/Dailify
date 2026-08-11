import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

let role: "free" | "pro" | "pro+ai" = "free";
let userId = "vu1";

const { openaiMock, getUserMock } = vi.hoisted(() => {
  const openaiMock = {
    audio: { transcriptions: { create: vi.fn() } },
    responses: { create: vi.fn() },
  };
  return { openaiMock, getUserMock: vi.fn() };
});

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
  return {
    ...actual,
    getUserRole: vi.fn(async () => role),
    clerk: vi.fn(() => ({ users: { getUser: getUserMock } })),
  };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { getTask } from "../src/db/tasks";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(() => {
  vi.clearAllMocks();
  getUserMock.mockResolvedValue({ id: "vu1", unsafeMetadata: { timezone: "UTC" } });
});

function audioRequest() {
  const form = new FormData();
  form.append("audio", new File([new Uint8Array([1, 2, 3])], "audio.ogg", { type: "audio/ogg" }));
  return app.request("/tasks/voice", { method: "POST", body: form }, env);
}

describe("POST /tasks/voice", () => {
  it("403s a non-voice role without calling OpenAI", async () => {
    role = "pro";
    const res = await audioRequest();
    expect(res.status).toBe(403);
    expect(openaiMock.audio.transcriptions.create).not.toHaveBeenCalled();
    expect(openaiMock.responses.create).not.toHaveBeenCalled();
  });

  it("transcribes, creates tasks, and returns epoch-ms dates for a pro+ai role", async () => {
    role = "pro+ai";
    openaiMock.audio.transcriptions.create.mockResolvedValue({
      text: "Adiciona reunião com o time amanhã às 14h e almoço às 12h",
    });
    openaiMock.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        response: "Tarefas criadas! ✅",
        type: "create",
        tasks: [
          {
            title: "Reunião com o time",
            description: "",
            duration: "30min",
            priority: 2,
            repeat: "Off",
            date: "2026-08-03T14:00:00.000Z",
            alert: "2026-08-03T13:45:00.000Z",
            tags: ["work"],
          },
          {
            title: "Almoço",
            description: "",
            duration: "1h",
            priority: 0,
            repeat: "Off",
            date: "2026-08-03T12:00:00.000Z",
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
    expect(meeting.alert).toBe(Date.UTC(2026, 7, 3, 13, 45, 0));
    expect(lunch.date).toBe(Date.UTC(2026, 7, 3, 12, 0, 0));
    expect(lunch.alert).toBeUndefined();

    const saved = await getTask(env.DB, "vu1", meeting.id);
    expect(saved).toMatchObject({ title: "Reunião com o time", date: meeting.date });
  });

  it("reinterprets GPT's naive-local dates using the user's non-UTC timezone (America/Sao_Paulo, UTC-3)", async () => {
    role = "pro+ai";
    userId = "vu3";
    getUserMock.mockResolvedValue({
      id: "vu3",
      unsafeMetadata: { timezone: "America/Sao_Paulo" },
    });
    openaiMock.audio.transcriptions.create.mockResolvedValue({
      text: "Adiciona reunião às 14h",
    });
    openaiMock.responses.create.mockResolvedValue({
      output_text: JSON.stringify({
        response: "Tarefa criada! ✅",
        type: "create",
        tasks: [
          {
            title: "Reunião",
            description: "",
            duration: "30min",
            priority: 2,
            repeat: "Off",
            // Naive local (no 'Z', no offset) — GPT reasons entirely in the user's local time.
            date: "2026-08-03T14:00:00",
            alert: "2026-08-03T13:45:00",
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
    // 13:45 BRT === 16:45 UTC
    expect(body.tasks[0].alert).toBe(Date.UTC(2026, 7, 3, 16, 45, 0));
  });

  it("does not insert tasks for a non-create ('invalid') AI response", async () => {
    role = "pro+ai";
    userId = "vu2";
    openaiMock.audio.transcriptions.create.mockResolvedValue({
      text: "quantos dias faltam pro natal?",
    });
    openaiMock.responses.create.mockResolvedValue({
      output_text: JSON.stringify({ response: "Só crio ou listo tarefas.", type: "invalid" }),
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
    role = "pro+ai";
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
