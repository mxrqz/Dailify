/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import type { Task } from "@dailify/shared";
import { addMonths, startOfMonth } from "date-fns";

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

function mount() {
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
  return () => ctx;
}

beforeEach(() => {
  api.getTasksForMonth.mockReset();
});

describe("<DailifyProvider>", () => {
  it("resposta velha do mesmo mês não sobrescreve a releitura mais nova", async () => {
    const replies: ((tasks: Task[]) => void)[] = [];
    api.getTasksForMonth.mockImplementation(
      () => new Promise((resolve) => replies.push((tasks) => resolve({ tasks }))),
    );
    const get = mount();

    const march = new Date(2027, 2, 1);
    let old!: Promise<void>;
    let fresh!: Promise<unknown>;
    await act(async () => {
      old = get().loadMonth(march);
      await vi.waitFor(() => expect(replies).toHaveLength(1));
      fresh = get().reloadMonths([march]);
      await vi.waitFor(() => expect(replies).toHaveLength(2));
    });
    await act(async () => {
      replies[1]([task("nova")]);
      await fresh;
      replies[0]([task("velha")]);
      await old;
    });

    expect(get().tasks?.map((t) => t.title)).toEqual(["nova"]);
  });

  it.each([-3, 3])("goToDay a %i meses carrega os do meio antes de marcar o alvo", async (n) => {
    const replies: (() => void)[] = [];
    api.getTasksForMonth.mockImplementation(
      () => new Promise((resolve) => replies.push(() => resolve({ tasks: [] }))),
    );
    const get = mount();
    const day = addMonths(new Date(), n);

    let going!: Promise<void>;
    await act(async () => {
      going = get().goToDay(day);
      // De hoje ao dia, inclusive: 4 meses, nenhum ainda pedido.
      await vi.waitFor(() => expect(replies).toHaveLength(4));
    });
    const asked = api.getTasksForMonth.mock.calls.map(([, m]) => m.getTime());
    const from = startOfMonth(n < 0 ? day : new Date());
    expect(asked).toEqual([0, 1, 2, 3].map((i) => addMonths(from, i).getTime()));
    expect(get().targetDay).toBeUndefined();

    await act(async () => {
      replies.forEach((reply) => reply());
      await going;
    });
    expect(get().targetDay).toEqual(day);
  });
});
