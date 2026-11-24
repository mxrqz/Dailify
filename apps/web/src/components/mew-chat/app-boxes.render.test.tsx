/** @vitest-environment jsdom */
import { useReducer } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { fill } from "@/functions/functions";

import { SendBody } from "./app-boxes";
import { copy as t } from "./copy";
import { type ChatAction, type SendBlock, chatReducer } from "./thread";

const mail: SendBlock = {
  kind: "send",
  id: "m",
  provider: "gmail",
  target: "ana@x.com",
  to: "ana@x.com",
  subject: "Reunião",
  text: "Oi, Ana\nAté lá.",
  step: "draft",
};
const slack: SendBlock = {
  kind: "send",
  id: "s",
  provider: "slack",
  target: "#geral",
  to: "#geral",
  text: "Já revisei!",
  step: "draft",
};
const issue: SendBlock = {
  kind: "send",
  id: "i",
  provider: "github",
  target: "acme/app",
  to: "acme/app",
  subject: "Crash ao salvar",
  text: "Passos pra reproduzir",
  labels: ["bug", "ui"],
  assign: true,
  step: "draft",
};

/** The box over the real reducer, so edits land; `spy` sees every action. */
function Harness({ block, spy }: { block: SendBlock; spy: (a: ChatAction) => void }) {
  const [messages, dispatch] = useReducer(chatReducer, [
    { id: "r", from: "mew", text: "", typing: false, blocks: [block] },
  ]);
  const current = messages
    .flatMap((m) => (m.from === "mew" ? m.blocks : []))
    .find((b): b is SendBlock => b.kind === "send");
  if (!current) return null;
  return (
    <SendBody
      block={current}
      dispatch={(action) => {
        spy(action);
        dispatch(action);
      }}
    />
  );
}

const mount = (block: SendBlock) => {
  const spy = vi.fn();
  render(<Harness block={block} spy={spy} />);
  return { spy, user: userEvent.setup() };
};

describe("SendBody drafts", () => {
  it("an e-mail shows Para, Assunto and the body; Editar edits both in place", async () => {
    const { spy, user } = mount(mail);
    expect(screen.getByText(t.sendBox.mail)).toBeInTheDocument();
    expect(screen.getByText(fill(t.sendBox.via, { app: "Gmail" }))).toBeInTheDocument();
    expect(screen.getByText("ana@x.com")).toBeInTheDocument();
    expect(screen.getByText("Reunião")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t.sendBox.edit }));
    expect(screen.getByRole("button", { name: t.sendBox.editDone })).toBeInTheDocument();
    const subject = screen.getByRole("textbox", { name: t.sendBox.subject });
    await user.clear(subject);
    await user.type(subject, "Amanhã");
    await user.clear(screen.getByRole("textbox", { name: t.sendBox.text }));
    await user.type(screen.getByRole("textbox", { name: t.sendBox.text }), "Oi!");
    // The address is never a field.
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: t.sendBox.editDone }));
    expect(screen.getByText("Amanhã")).toBeInTheDocument();
    expect(screen.getByText("Oi!")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.sendBox.send }));
    expect(spy).toHaveBeenLastCalledWith({ type: "deliver", block: "m" });
  });

  it("an older e-mail draft without a subject edits only its text", async () => {
    const { user } = mount({ ...mail, subject: undefined, text: "Reunião\nOi, Ana" });
    expect(screen.queryByText(t.sendBox.subject)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.sendBox.edit }));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("a Slack message reads like one: the channel, Você · agora, the text", () => {
    mount(slack);
    expect(screen.getByText("#geral")).toBeInTheDocument();
    expect(screen.getByText(t.sendBox.byline)).toBeInTheDocument();
    expect(screen.getByText("Já revisei!")).toBeInTheDocument();
  });

  it("an issue shows its repo, title, labels and an on Atribuir a mim switch", async () => {
    const { spy, user } = mount(issue);
    expect(screen.getByText(t.sendBox.issue)).toBeInTheDocument();
    expect(screen.getByText("acme/app")).toBeInTheDocument();
    expect(screen.getByText("Crash ao salvar")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
    const assign = screen.getByRole("switch", { name: t.sendBox.assign });
    expect(assign).toBeChecked();
    await user.click(assign);
    expect(assign).not.toBeChecked();
    expect(spy).toHaveBeenLastCalledWith({ type: "draft", block: "i", assign: false });
  });

  it("an issue without a title can't be created", async () => {
    const { user } = mount(issue);
    await user.click(screen.getByRole("button", { name: t.sendBox.edit }));
    await user.clear(screen.getByRole("textbox", { name: t.sendBox.title }));
    expect(screen.getByRole("button", { name: t.sendBox.create })).toBeDisabled();
  });

  it("a failed try keeps the draft with the warning line", () => {
    mount({ ...slack, failed: true });
    expect(screen.getByRole("alert")).toHaveTextContent(t.sendBox.failed);
    expect(screen.getByRole("button", { name: t.sendBox.send })).toBeEnabled();
  });
});

describe("SendBody after Enviar", () => {
  it("collapses to one line while sending", () => {
    mount({ ...mail, step: "done", sending: true });
    expect(screen.getByRole("status")).toHaveTextContent(
      fill(t.sendBox.sending, { to: "ana@x.com" }),
    );
    mount({ ...issue, id: "i2", step: "done", sending: true });
    expect(screen.getByText(t.sendBox.creating)).toBeInTheDocument();
  });

  it("a sent e-mail names the address, its subject and links to the sent folder", () => {
    const url = "https://mail.google.com/mail/u/0/#sent/abc";
    mount({ ...mail, step: "done", url });
    expect(screen.getByText(fill(t.sendBox.sent, { to: "ana@x.com" }))).toBeInTheDocument();
    expect(screen.getByText("Reunião")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.sendBox.seeMail })).toHaveAttribute("href", url);
  });

  it("a sent Slack message says where and links to it", () => {
    mount({ ...slack, step: "done", url: "https://acme.slack.com/archives/C1/p1" });
    expect(screen.getByText(fill(t.sendBox.sentIn, { to: "#geral" }))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.sendBox.seeSlack })).toBeInTheDocument();
  });

  it("a created issue shows its number, the assignment and the GitHub link", () => {
    const url = "https://github.com/acme/app/issues/3";
    mount({ ...issue, step: "done", url, ref: "acme/app#3" });
    expect(screen.getByText(fill(t.sendBox.created, { n: "3" }))).toBeInTheDocument();
    expect(screen.getByText(t.sendBox.assigned)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.sendBox.seeIssue })).toHaveAttribute("href", url);
  });

  it("an unassigned issue doesn't claim a task, and an older sent box has no link", () => {
    mount({ ...issue, step: "done", assign: false, ref: "acme/app#3" });
    expect(screen.queryByText(t.sendBox.assigned)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
