import { type CSSProperties, Fragment, type ReactNode } from "react";
import type { Task } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { MessageBox } from "@/components/mew/message-box";
import { MewStatic } from "@/components/mew/mew-static";
import { cn } from "@/lib/utils";

import { ConfirmBody, Row } from "./confirm-box";
import { isConfirm } from "./mood";
import type { ChatAction, Message, Step } from "./thread";

const t = copy.mewChat;
const DOT_STAGGER_MS = 150;

/** `.mine`: accent bubble, tight corner at the bottom right, never wider than `max-w-bubble`. */
export function Mine({ message }: { message: Extract<Message, { from: "me" }> }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {message.image && (
        <img
          src={message.image}
          alt={t.photo}
          className="max-h-40 max-w-bubble rounded-lg rounded-br-xs object-cover"
        />
      )}
      {message.text && (
        <p className="max-w-bubble rounded-lg rounded-br-xs bg-brand px-3.5 py-2 text-subhead text-on-brand">
          {message.text}
        </p>
      )}
    </div>
  );
}

// Decorative: the header's live region already says "Pensando…".
function Dots() {
  return (
    <span aria-hidden="true" className="inline-flex h-5 items-center gap-0.75">
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          className="size-1.5 animate-dot rounded-full bg-ink-tertiary motion-reduce:animate-none"
          style={{ animationDelay: `${i * DOT_STAGGER_MS}ms` }}
        />
      ))}
    </span>
  );
}

/** Steps that close a confirmation: the whole message morphs to them (MessageBox). */
const FINAL: Step[] = ["done", "cancelled", "undone"];

/** `--i` staggers a word (`word-in`), `--words` delays what follows the text (`delay-words`). */
const cssVar = (name: "--i" | "--words", n: number): CSSProperties & Record<string, number> => ({
  [name]: n,
});

/**
 * One Mew message = one container (ears on top): the text, then each block opens under it, its
 * buttons at the foot. Typing → text and a confirmation closing morph the whole box.
 */
export function Reply({
  message,
  fresh,
  dispatch,
  onOpenTask,
}: {
  message: Extract<Message, { from: "mew" }>;
  fresh: boolean;
  dispatch: (action: ChatAction) => void;
  onOpenTask: (task: Task) => void;
}) {
  const confirm = message.blocks.find(isConfirm);
  const key = message.typing
    ? "typing"
    : confirm && FINAL.includes(confirm.step)
      ? confirm.step
      : "text";
  const words = message.text.split(" ");
  return (
    <div className="flex items-end gap-2">
      <MewStatic happy={confirm?.step === "done"} className="mb-0.5 w-6.5 flex-none" />
      <MessageBox type="text" contentKey={key} className="max-w-bubble">
        {message.typing ? (
          <Dots />
        ) : (
          <>
            {/* Every word is in the DOM at once, so the box morphs to its final size. */}
            <p className="min-h-2lh text-subhead">
              {words.map((word, i) => (
                <Fragment key={i}>
                  {i > 0 && " "}
                  <span className={cn("inline-block", fresh && "word-in")} style={cssVar("--i", i)}>
                    {word}
                  </span>
                </Fragment>
              ))}
            </p>
            {message.blocks.map((block, i) => (
              <Reveal
                key={i}
                enter={fresh && (block.kind === "tasks" || !FINAL.includes(block.step))}
                words={words.length}
                className="pt-2.5"
              >
                {block.kind === "tasks" ? (
                  <ul className="flex flex-col gap-1.5">
                    {block.tasks.map((task) => (
                      <li key={`${task.id}-${task.date}`}>
                        <Row task={task} onOpen={() => onOpenTask(task)} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ConfirmBody block={block} dispatch={dispatch} />
                )}
              </Reveal>
            ))}
          </>
        )}
      </MessageBox>
    </div>
  );
}

// Opens its own height on mount (grid rows 0fr → 1fr via `@starting-style`) while the content fades up.
export function Reveal({
  enter,
  words,
  className,
  children,
}: {
  enter: boolean;
  /** Under a reply: wait for its last word. */
  words?: number;
  className: string;
  children: ReactNode;
}) {
  return (
    <div
      style={words ? cssVar("--words", words) : undefined}
      className={cn(
        "grid flex-none grid-rows-[1fr]",
        enter &&
          "transition-[grid-template-rows] delay-words duration-open ease-out-quint starting:grid-rows-[0fr] motion-reduce:transition-none",
      )}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden",
          enter &&
            "transition-[opacity,translate] delay-words-lag duration-slow ease-out starting:translate-y-2.5 starting:opacity-0 motion-reduce:transition-none",
        )}
      >
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}
