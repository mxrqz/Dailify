import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { INTEGRATIONS, MEW_SEND_MAX } from "@dailify/shared";

import { Button } from "@/components/ui/button";
import { fill } from "@/functions/functions";

import { copy as t } from "./copy";
import type { ChatAction, PermissionBlock, SendBlock } from "./thread";

// Props only, like the confirm box they sit beside.
const DONE = "flex items-center gap-1.5 text-subhead font-semibold text-brand-text";
const QUOTE = "mt-1.5 border-l-2 border-separator pl-2.5 text-footnote text-ink-secondary";

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

/** A message draft for a connected app: always asks, editable inline before sending. */
export function SendBody({
  block,
  dispatch,
}: {
  block: SendBlock;
  dispatch: (action: ChatAction) => void;
}) {
  const [editing, setEditing] = useState(false);
  const values = { to: block.to, app: INTEGRATIONS[block.provider].name };
  if (block.step === "cancelled")
    return <p className="text-subhead text-ink-secondary">{t.sendBox.cancelled}</p>;
  if (block.step !== "draft")
    return (
      <>
        <div className={DONE}>
          <CheckIcon aria-hidden="true" className="size-4" strokeWidth={2.6} />
          {fill(t.sendBox.sent, values)}
        </div>
        <p className={QUOTE}>{block.text}</p>
      </>
    );
  return (
    <>
      <Head
        title={fill(t.sendBox.title, values)}
        source={fill(block.provider === "gmail" ? t.sendBox.sourceMail : t.sendBox.source, values)}
      />
      {editing ? (
        <textarea
          value={block.text}
          aria-label={t.sendBox.text}
          maxLength={MEW_SEND_MAX}
          rows={4}
          // The Editar button it replaces held the focus.
          autoFocus
          onChange={(event) =>
            dispatch({ type: "draft", block: block.id, text: event.target.value })
          }
          className="w-full resize-none rounded-md bg-fill px-3 py-2 text-subhead outline-none focus-ring"
        />
      ) : (
        <p className="rounded-md bg-fill px-3 py-2 text-subhead whitespace-pre-wrap">
          {block.text}
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => dispatch({ type: "cancel", block: block.id })}
        >
          {t.sendBox.cancel}
        </Button>
        {!editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {t.sendBox.edit}
          </Button>
        )}
        <Button
          size="sm"
          disabled={!block.text.trim()}
          onClick={() => dispatch({ type: "deliver", block: block.id })}
        >
          {t.sendBox.send}
        </Button>
      </div>
    </>
  );
}
