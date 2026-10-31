/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import type { Task } from "@dailify/shared";

const { api } = vi.hoisted(() => ({ api: { getTasksForMonth: vi.fn() } }));
vi.mock("@/functions/api", () => api);
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));

import { DailifyProvider, useDailify } from "./dailifyContext";

const task = (title: string): Task => ({
  id: "1",
  title,
  completed: [],
  duration: "30",
  priority: 0,
  repeat: "Off",
  date: new Date(2027, 2, 10).getTime(),
});

describe("<DailifyProvider>", () => {
  it("resposta velha do mesmo mês não sobrescreve a releitura mais nova", async () => {
    const replies: ((tasks: Task[]) => void)[] = [];
    api.getTasksForMonth.mockImplementation(
      () => new Promise((resolve) => replies.push((tasks) => resolve({ tasks }))),
    );
    let ctx!: ReturnType<typeof useDailify>;
    const Probe = () => {
      ctx = useDailify();
      return null;
    };
    render(
      <DailifyProvider>
        <Probe />
      </DailifyProvider>,
    );

    const march = new Date(2027, 2, 1);
    let old!: Promise<void>;
    let fresh!: Promise<unknown>;
    await act(async () => {
      old = ctx.loadMonth(march);
      await vi.waitFor(() => expect(replies).toHaveLength(1));
      fresh = ctx.reloadMonths([march]);
      await vi.waitFor(() => expect(replies).toHaveLength(2));
    });
    await act(async () => {
      replies[1]([task("nova")]);
      await fresh;
      replies[0]([task("velha")]);
      await old;
    });

    expect(ctx.tasks?.map((t) => t.title)).toEqual(["nova"]);
  });
});
