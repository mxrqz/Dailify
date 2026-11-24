import { useState, type ReactNode, type SVGProps } from "react";
import {
  ArrowUpRightIcon,
  CheckIcon,
  CircleAlertIcon,
  Loader2Icon,
  PlusIcon,
  SendIcon,
} from "lucide-react";
import { INTEGRATIONS, MEW_SEND_MAX, MEW_SUBJECT_MAX, type ProviderId } from "@dailify/shared";

import { Switch } from "@/components/kit/switch";
import { GitHubLogo, GmailLogo, SlackLogo } from "@/components/logos";
import { Button } from "@/components/ui/button";
import { fill } from "@/functions/functions";
import { cn } from "@/lib/utils";

import { copy as t } from "./copy";
import { AVATAR, PILL } from "./items-box";
import type { ChatAction, PermissionBlock, SendBlock } from "./thread";

// Props only, like the confirm box they sit beside.
const DONE = "flex items-center gap-1.5 text-subhead font-semibold text-brand-text";

function Head({ title, source }: { title: string; source: string }) {
  return (
    <div className="mb-2.5">
      <b className="block text-subhead font-semibold">{title}</b>
      <span className="text-footnote text-ink-secondary">{source}</span>
    </div>
  );
}

/** "Posso ler #geral?": deny, once or always. Allowing re-sends the turn (mew-chat.tsx). */
export function PermissionBody({
  block,
  dispatch,
}: {
  block: PermissionBlock;
  dispatch: (action: ChatAction) => void;
}) {
  const values = { label: block.label, app: INTEGRATIONS[block.provider].name };
  if (block.step === "cancelled")
    return <p className="text-subhead text-ink-secondary">{fill(t.readBox.denied, values)}</p>;
  if (block.step !== "draft")
    return (
      <div className={DONE}>
        <CheckIcon aria-hidden="true" className="size-4" strokeWidth={2.6} />
        {fill(t.readBox.allowed, values)}
      </div>
    );
  return (
    <>
      <Head title={fill(t.readBox.title, values)} source={fill(t.readBox.source, values)} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => dispatch({ type: "cancel", block: block.id })}
        >
          {t.readBox.deny}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => dispatch({ type: "allow", block: block.id, always: false })}
        >
          {t.readBox.once}
        </Button>
        <Button
          size="sm"
          onClick={() => dispatch({ type: "allow", block: block.id, always: true })}
        >
          {t.readBox.always}
        </Button>
      </div>
    </>
  );
}

const LOGOS: Partial<Record<ProviderId, (props: SVGProps<SVGSVGElement>) => JSX.Element>> = {
  gmail: GmailLogo,
  slack: SlackLogo,
  github: GitHubLogo,
};
const SEE: Partial<Record<ProviderId, string>> = {
  gmail: t.sendBox.seeMail,
  slack: t.sendBox.seeSlack,
  github: t.sendBox.seeIssue,
};
const ROW = "flex gap-3 border-t border-separator px-3 py-2.5";
const FIELD = "w-full rounded-sm bg-fill px-3 py-2 text-subhead outline-none focus-ring";
// The 32px buttons keep a 44px touch area.
const TAP = "relative hit-target";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ROW}>
      <span className="w-14 flex-none pt-px text-footnote text-ink-secondary">{label}</span>
      <div className="min-w-0 flex-1 text-subhead">{children}</div>
    </div>
  );
}

/** The draft: an e-mail (Para, Assunto, body), a Slack-style message, or a GitHub issue. */
function SendDraft({
  block,
  dispatch,
}: {
  block: SendBlock;
  dispatch: (action: ChatAction) => void;
}) {
  const [editing, setEditing] = useState(false);
  const issue = block.provider === "github";
  const mail = block.provider === "gmail";
  const Logo = LOGOS[block.provider];
  const edit = (change: { text?: string; subject?: string; assign?: boolean }) =>
    dispatch({ type: "draft", block: block.id, ...change });
  // An older e-mail draft has no subject: it is the first line of the text.
  const subject = block.subject;
  const ready = issue ? !!subject?.trim() : !!block.text.trim();
  const body = editing ? (
    <textarea
      value={block.text}
      aria-label={issue ? t.sendBox.description : t.sendBox.text}
      maxLength={MEW_SEND_MAX}
      rows={4}
      // The Editar button it replaces held the focus.
      autoFocus={subject === undefined}
      onChange={(event) => edit({ text: event.target.value })}
      className={cn(FIELD, "resize-none")}
    />
  ) : (
    <p className={cn("whitespace-pre-wrap", issue && "text-ink-secondary")}>{block.text}</p>
  );
  return (
    <div className="overflow-hidden rounded-md bg-surface">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {Logo && <Logo aria-hidden="true" className="size-4 flex-none" />}
        <b className="min-w-0 flex-1 truncate text-subhead font-semibold">
          {issue ? t.sendBox.issue : mail ? t.sendBox.mail : block.to}
        </b>
        <span className="min-w-0 truncate text-footnote text-ink-secondary">
          {issue ? block.to : fill(t.sendBox.via, { app: INTEGRATIONS[block.provider].name })}
        </span>
      </div>
      {mail && <Field label={t.sendBox.to}>{block.to}</Field>}
      {subject !== undefined && (
        <Field label={issue ? t.sendBox.title : t.sendBox.subject}>
          {editing ? (
            <input
              value={subject}
              aria-label={issue ? t.sendBox.title : t.sendBox.subject}
              maxLength={MEW_SUBJECT_MAX}
              autoFocus
              onChange={(event) => edit({ subject: event.target.value })}
              className={FIELD}
            />
          ) : (
            <p className="font-semibold">{subject}</p>
          )}
        </Field>
      )}
      {mail || issue ? (
        <div className="border-t border-separator px-3 py-2.5 text-subhead">{body}</div>
      ) : (
        <div className={ROW}>
          <span aria-hidden="true" className={AVATAR}>
            {t.sendBox.you}
          </span>
          <div className="min-w-0 flex-1 text-subhead">
            <p className="text-footnote text-ink-secondary">{t.sendBox.byline}</p>
            {body}
          </div>
        </div>
      )}
      {issue && !!block.labels?.length && (
        <Field label={t.sendBox.labels}>
          <div className="flex flex-wrap gap-1">
            {block.labels.map((label) => (
              <span key={label} className={PILL}>
                {label}
              </span>
            ))}
          </div>
        </Field>
      )}
      {issue && (
        <div className="flex items-center gap-3 border-t border-separator px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-subhead">{t.sendBox.assign}</p>
            <p className="text-footnote text-ink-secondary">{t.sendBox.assignHint}</p>
          </div>
          <Switch
            checked={block.assign ?? false}
            aria-label={t.sendBox.assign}
            onCheckedChange={(assign) => edit({ assign })}
          />
        </div>
      )}
      {block.failed && (
        <p
          role="alert"
          className="flex items-center gap-1.5 border-t border-separator px-3 py-2 text-footnote text-brand-text"
        >
          <CircleAlertIcon aria-hidden="true" className="size-4 flex-none" />
          {t.sendBox.failed}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-separator px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          className={TAP}
          onClick={() => dispatch({ type: "cancel", block: block.id })}
        >
          {t.sendBox.cancel}
        </Button>
        <Button size="sm" variant="secondary" className={TAP} onClick={() => setEditing(!editing)}>
          {editing ? t.sendBox.editDone : t.sendBox.edit}
        </Button>
        <Button
          size="sm"
          className={TAP}
          disabled={!ready}
          onClick={() => dispatch({ type: "deliver", block: block.id })}
        >
          {issue ? <PlusIcon aria-hidden="true" /> : <SendIcon aria-hidden="true" />}
          {issue ? t.sendBox.create : t.sendBox.send}
        </Button>
      </div>
    </div>
  );
}

/** What went out: one line, the assignment for an issue, and a link to it when the app gave one. */
function Sent({ block }: { block: SendBlock }) {
  const issue = block.provider === "github";
  const n = block.ref?.split("#").at(-1);
  const title =
    issue && n
      ? fill(t.sendBox.created, { n })
      : fill(block.provider === "slack" ? t.sendBox.sentIn : t.sendBox.sent, { to: block.to });
  const see = SEE[block.provider] ?? fill(t.items.open, { app: INTEGRATIONS[block.provider].name });
  return (
    <div className="rounded-md bg-surface px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-subhead font-semibold">
        <CheckIcon aria-hidden="true" className="size-4 flex-none text-success" strokeWidth={2.6} />
        {title}
      </p>
      <p className="mt-0.5 truncate text-footnote text-ink-secondary">
        {block.subject ?? block.text}
      </p>
      {issue && block.assign && (
        <p className="text-footnote text-ink-secondary">{t.sendBox.assigned}</p>
      )}
      {block.url && (
        <a
          href={block.url}
          target="_blank"
          rel="noreferrer"
          className="relative mt-1.5 hit-target inline-flex items-center gap-1 text-footnote text-ink-secondary focus-ring"
        >
          {see}
          <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
        </a>
      )}
    </div>
  );
}

/** A draft for a connected app: always asks, editable in place, never "always allow". */
export function SendBody({
  block,
  dispatch,
}: {
  block: SendBlock;
  dispatch: (action: ChatAction) => void;
}) {
  if (block.step === "cancelled")
    return <p className="text-subhead text-ink-secondary">{t.sendBox.cancelled}</p>;
  if (block.step === "draft") return <SendDraft block={block} dispatch={dispatch} />;
  if (block.sending)
    return (
      <p role="status" className="flex items-center gap-2 text-subhead text-ink-secondary">
        <Loader2Icon
          aria-hidden="true"
          className="size-4 flex-none animate-spin motion-reduce:animate-none"
        />
        {block.provider === "github"
          ? t.sendBox.creating
          : fill(t.sendBox.sending, { to: block.to })}
      </p>
    );
  return <Sent block={block} />;
}
