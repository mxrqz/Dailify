/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ online: true, pending: 0 }));

vi.mock("@/hooks/useOnline", () => ({ useOnline: () => m.online }));
vi.mock("@/lib/auth", () => ({ useSession: () => ({ data: { user: { id: "u1" } } }) }));
vi.mock("@/components/dailifyContext", () => ({ useDailify: () => ({ tasks: [] }) }));
vi.mock("@/functions/offline", () => ({ pendingCount: () => m.pending }));

import { copy } from "@/components/dashboard/copy";
import { SyncBadge } from "./sync-badge";

describe("<SyncBadge>", () => {
  beforeEach(() => {
    m.online = true;
    m.pending = 0;
  });

  it("renders nothing online with an empty queue", () => {
    const { container } = render(<SyncBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says offline when the connection drops with nothing queued", () => {
    m.online = false;
    render(<SyncBadge />);
    expect(screen.getByText(copy.sync.offline)).toBeInTheDocument();
  });

  it("counts pending writes while online without claiming to be offline", () => {
    m.pending = 3;
    render(<SyncBadge />);
    expect(screen.getByText("3 pendentes")).toBeInTheDocument();
    expect(screen.queryByText(copy.sync.offline)).toBeNull();
    expect(screen.queryByTitle(copy.sync.offline)).toBeNull();
  });
});
