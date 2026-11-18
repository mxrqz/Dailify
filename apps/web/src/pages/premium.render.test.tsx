/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const { useSession, checkout } = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: null })),
  checkout: vi.fn(),
}));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useSession,
}));
vi.mock("@/functions/api", () => ({ checkout }));

import PremiumPage from "./premium";
import { redirectTarget } from "@/components/auth/auth-state";
import { copy } from "@/components/pricing/copy";

function Login() {
  return <p>{redirectTarget(useLocation().state)}</p>;
}

describe("<PremiumPage>", () => {
  it("sends a signed-out visitor to /login and back to /premium", async () => {
    render(
      <MemoryRouter initialEntries={["/premium?cycle=x"]}>
        <Routes>
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>,
    );
    const name = copy.page.choosePlan.replace("{plan}", copy.plans.pro.name);
    await userEvent.click(screen.getAllByRole("button", { name })[0]);

    expect(screen.getByText("/premium?cycle=x")).toBeInTheDocument();
    expect(checkout).not.toHaveBeenCalled();
  });
});
