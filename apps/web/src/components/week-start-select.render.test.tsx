/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useDailify, useAuth, saveSettings, toastError } = vi.hoisted(() => ({
  useDailify: vi.fn(),
  useAuth: vi.fn(),
  saveSettings: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@clerk/clerk-react", () => ({ useAuth }));
vi.mock("@/components/dailifyContext", () => ({ useDailify }));
vi.mock("@/functions/api", () => ({ saveSettings }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { WeekStartSelect } from "./week-start-select";
import { copy } from "@/components/dashboard/copy";

const setWeekStart = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useDailify.mockReturnValue({ weekStart: 1, setWeekStart });
  useAuth.mockReturnValue({ getToken: async () => "t" });
});

describe("<WeekStartSelect>", () => {
  it("marca o valor do contexto", () => {
    render(<WeekStartSelect />);
    expect(screen.getByRole("radio", { name: copy.form.repeatDays[1] })).toBeChecked();
  });

  it("escolher domingo salva 0 e atualiza o contexto", async () => {
    saveSettings.mockResolvedValue({ weekStart: 0 });
    render(<WeekStartSelect />);
    await userEvent.click(screen.getByRole("radio", { name: copy.form.repeatDays[0] }));

    expect(setWeekStart).toHaveBeenCalledWith(0);
    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith("t", 0));
    expect(toastError).not.toHaveBeenCalled();
  });

  it("erro da API volta ao anterior e avisa", async () => {
    saveSettings.mockResolvedValue({ error: { message: "x" } });
    render(<WeekStartSelect />);
    await userEvent.click(screen.getByRole("radio", { name: copy.form.repeatDays[0] }));

    await waitFor(() => expect(setWeekStart).toHaveBeenLastCalledWith(1));
    expect(toastError).toHaveBeenCalledWith(copy.profile.weekStartError);
  });

  it("clicar no item ativo não faz nada", async () => {
    render(<WeekStartSelect />);
    await userEvent.click(screen.getByRole("radio", { name: copy.form.repeatDays[1] }));
    expect(setWeekStart).not.toHaveBeenCalled();
  });
});
