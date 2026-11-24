/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MewCardItem } from "@dailify/shared";

import { fill } from "@/functions/functions";

import { copy as t } from "./copy";
import { ItemsBox, ItemsView, ago } from "./items-box";
import type { ItemsBlock } from "./thread";

const hooks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/hooks/useCreateTask", () => ({ useCreateTask: () => ({ create: hooks.create }) }));

const NOW = Date.UTC(2026, 10, 23, 12);
const DAY = 86_400_000;

const issue = (n: number, extra: Partial<MewCardItem> = {}): MewCardItem => ({
  title: `Item ${n}`,
  url: `https://github.com/acme/app/issues/${n}`,
  icon: "issue",
  where: `acme/app #${n}`,
  at: NOW - 2 * DAY,
  linked: false,
  ...extra,
});

const list: ItemsBlock = {
  kind: "items",
  provider: "github",
  source: "GitHub",
  url: "https://github.com/issues/assigned",
  total: 7,
  items: [
    issue(1, { linked: true, labels: ["bug"] }),
    issue(2, { icon: "pr", review: true }),
    issue(3),
  ],
};

const view = (block: ItemsBlock, onAdd = vi.fn()) =>
  render(<ItemsView block={block} now={NOW} added={[]} onAdd={onAdd} />);

describe("ItemsView", () => {
  it("lists rows with their meta, a check on linked ones and +N for the rest", () => {
    view(list);
    expect(screen.getByText(fill(t.items.openIssues, { n: 7 }))).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByRole("img", { name: t.items.linked })).toBeInTheDocument();
    expect(within(rows[0]).queryByRole("button", { name: t.items.add })).toBeNull();
    expect(within(rows[0]).getByText("bug")).toBeInTheDocument();
    expect(within(rows[0]).getByText("há 2 dias")).toBeInTheDocument();
    expect(within(rows[1]).getByText(t.items.review)).toBeInTheDocument();
    expect(within(rows[1]).getByRole("button", { name: t.items.add })).toBeInTheDocument();
    expect(within(rows[2]).getByRole("link", { name: /Item 3/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/app/issues/3",
    );
    expect(screen.getByText("+4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir no GitHub" })).toHaveAttribute(
      "rel",
      "noreferrer",
    );
  });

  it("a Slack card shows the author, the mention chip and the replies", () => {
    view({
      kind: "items",
      provider: "slack",
      source: "#produto",
      url: "https://acme.slack.com/archives/C1",
      total: 1,
      items: [
        {
          title: "@Bia pode revisar?",
          url: "https://acme.slack.com/archives/C1/p1",
          icon: "message",
          author: "João",
          at: NOW - 3 * 60_000,
          mention: true,
          replies: 6,
        },
      ],
    });
    expect(screen.getByText("#produto")).toBeInTheDocument();
    expect(screen.getByText(fill(t.items.messages, { n: 1 }))).toBeInTheDocument();
    expect(screen.getByText(t.items.mention)).toBeInTheDocument();
    expect(screen.getByText("6 respostas")).toBeInTheDocument();
    expect(screen.getByText("há 3 minutos")).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it("the detail shows state, body and the last comments, and adds from the footer", async () => {
    const onAdd = vi.fn();
    const item = issue(3);
    view(
      {
        kind: "items",
        provider: "github",
        source: "acme/app #3",
        url: item.url,
        total: 1,
        items: [item],
        detail: {
          state: "open",
          author: "bia-dev",
          comments: 4,
          body: "Steps to reproduce",
          recent: [{ author: "ana", at: NOW - DAY, text: "Same here" }],
        },
      },
      onAdd,
    );
    expect(screen.getByText(t.items.stateOpen)).toBeInTheDocument();
    expect(screen.getByText("bia-dev abriu há 2 dias")).toBeInTheDocument();
    expect(screen.getByText("4 comentários")).toBeInTheDocument();
    expect(screen.getByText("Steps to reproduce")).toBeInTheDocument();
    expect(screen.getByText(t.items.recent)).toBeInTheDocument();
    expect(screen.getByText("Same here")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: t.items.add }));
    expect(onAdd).toHaveBeenCalledWith(item);
  });
});

describe("ago", () => {
  it("picks the largest whole unit, a minute at least", () => {
    expect(ago(NOW, NOW)).toBe("há 1 minuto");
    expect(ago(NOW - 5 * 3_600_000, NOW)).toBe("há 5 horas");
    expect(ago(NOW - 400 * DAY, NOW)).toBe("há 1 ano");
  });
});

describe("ItemsBox", () => {
  it("Virar tarefa creates an undated task with the title and the link, then shows the check", async () => {
    hooks.create.mockResolvedValue(true);
    render(<ItemsBox block={{ ...list, items: [issue(2, { title: "  Fix login  " })] }} />);
    await userEvent.click(screen.getByRole("button", { name: t.items.add }));
    expect(hooks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Fix login",
        links: ["https://github.com/acme/app/issues/2"],
        date: null,
      }),
      { undatedOnly: true },
    );
    expect(await screen.findByRole("img", { name: t.items.linked })).toBeInTheDocument();
  });

  it("a refused create keeps the button", async () => {
    hooks.create.mockResolvedValue(false);
    render(<ItemsBox block={{ ...list, items: [issue(2)] }} />);
    await userEvent.click(screen.getByRole("button", { name: t.items.add }));
    expect(screen.getByRole("button", { name: t.items.add })).toBeInTheDocument();
  });
});
