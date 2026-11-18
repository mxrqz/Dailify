/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";

const { useSession, listSessions } = vi.hoisted(() => ({
  useSession: vi.fn(() => ({ data: { session: { id: "s1" } } })),
  listSessions: vi.fn(),
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth")>();
  return { ...real, useSession, authClient: { listSessions } };
});

import SecurityPage from "./security";
import { copy } from "@/components/dashboard/copy";

const row = (id: string) => ({
  id,
  token: `t-${id}`,
  userAgent: "",
  ipAddress: null,
  updatedAt: new Date(0),
});
describe("<SecurityPage>", () => {
  it("marks this device and offers no sign-out-others when it is the only session", async () => {
    listSessions.mockResolvedValue({ data: [row("s1")], error: null });
    render(
      <HelmetProvider>
        <SecurityPage />
      </HelmetProvider>,
    );

    expect(await screen.findByText(copy.profile.thisDevice)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.profile.revokeDevice })).toBeNull();
    expect(screen.queryByText(copy.profile.revokeOthers)).toBeNull();
  });

  it("lets another device be revoked and offers sign-out-others", async () => {
    listSessions.mockResolvedValue({ data: [row("s1"), row("s2")], error: null });
    render(
      <HelmetProvider>
        <SecurityPage />
      </HelmetProvider>,
    );

    expect(
      await screen.findByRole("button", { name: copy.profile.revokeDevice }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(copy.profile.thisDevice)).toHaveLength(1);
    expect(screen.getByText(copy.profile.revokeOthers)).toBeInTheDocument();
  });
});
