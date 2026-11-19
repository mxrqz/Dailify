import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EllipsisIcon, ImagePlusIcon, PlusIcon, XIcon } from "lucide-react";
import { motion } from "motion/react";
import type { Task } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Chip } from "@/components/kit/chip";
import { Mew } from "@/components/mew/mew";
import { MewStatic } from "@/components/mew/mew-static";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { spring } from "@/consts/motion";

import { Mine, Reply, Reveal } from "./bubbles";
import { INPUT_ID } from "./chat-input";
import { copy as t } from "./copy";
import { moodOf } from "./mood";
import type { ChatAction, Message } from "./thread";

const CHIP_DELAY = 0.1;
const CHIP_STAGGER = 0.05;

type Props = {
  messages: Message[];
  dispatch: (action: ChatAction) => void;
  busy: boolean;
  /** "Créditos de IA · 3 restantes"; `null` when unlimited or not loaded. */
  credits: string | null;
  /** `false`: the LGPD card shows until accepted; `undefined` = not read yet. */
  consent: boolean | undefined;
  onConsent: () => void;
  onSend: (text: string) => void;
  onPhoto: () => void;
  onCompose: () => void;
  onOpenTask: (task: Task) => void;
};

/** Near-full-height, non-modal sheet under the dock, which becomes its message box (`ChatInput`). */
export function ChatDrawer({
  open,
  onOpenChange,
  ...props
}: Props & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(INPUT_ID)?.focus();
        }}
        // Typing in the dock, or the credits tray rising over the chat, is not leaving it.
        onInteractOutside={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('[data-slot="create-dock"], [role="alertdialog"]')
          )
            event.preventDefault();
        }}
        className="z-chat h-11/12 px-0 pb-0 sm:mx-auto sm:w-sheet"
      >
        <ChatPanel {...props} />
      </SheetContent>
    </Sheet>
  );
}

function ChatPanel({
  messages,
  dispatch,
  busy,
  credits,
  consent,
  onConsent,
  onSend,
  onPhoto,
  onCompose,
  onOpenTask,
}: Props) {
  const log = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  // What was already there when the chat opened shows up as is; only new messages and blocks enter.
  const [initial] = useState(() => new Set(messages.map((m) => m.id)));

  // The only writer of scrollTop: glued to the newest message while it grows (rows opening, morphs),
  // unless scrolled up. Instant, so it never fights the animation.
  useEffect(() => {
    const el = log.current;
    const inner = list.current;
    if (!el || !inner) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    };
    const observer = new ResizeObserver(() => {
      if (pinned.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(inner);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // A new message re-pins; the observer above scrolls as its row opens.
  useLayoutEffect(() => {
    pinned.current = true;
  }, [messages.length]);

  return (
    <>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-3 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t.menu} className="justify-self-start">
              <EllipsisIcon aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onCompose}>{copy.composer.open}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => dispatch({ type: "clear" })}>
              {t.clear}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex flex-col items-center">
          <Mew mood={moodOf(messages.at(-1), busy)} className="w-14" />
          <SheetTitle className="sr-only">{t.title}</SheetTitle>
          <p aria-live="polite" className="sr-only">
            {busy ? t.thinking : ""}
          </p>
          {credits !== null && (
            <p className="mt-1 text-footnote text-ink-secondary tabular-nums">{credits}</p>
          )}
        </div>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" aria-label={t.close} className="justify-self-end">
            <XIcon aria-hidden="true" />
          </Button>
        </SheetClose>
      </header>

      {/* Newest at the bottom, against the dock; older ones scroll up under the fade. */}
      <div
        ref={log}
        role="log"
        aria-label={t.thread}
        className="fade-top flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4"
      >
        <div ref={list} className="flex grow flex-col justify-end pt-6 pb-dock-clear">
          {messages.length === 0 && consent !== false && (
            <Empty onPick={onSend} onPhoto={onPhoto} onCompose={onCompose} />
          )}
          {messages.map((m) => {
            const fresh = !initial.has(m.id);
            return (
              <Reveal key={m.id} enter={fresh} className="py-1.5">
                {m.from === "me" ? (
                  <Mine message={m} />
                ) : (
                  <Reply message={m} fresh={fresh} dispatch={dispatch} onOpenTask={onOpenTask} />
                )}
              </Reveal>
            );
          })}
          {consent === false && <Consent onAccept={onConsent} />}
        </div>
      </div>
    </>
  );
}

function Empty({
  onPick,
  onPhoto,
  onCompose,
}: {
  onPick: (text: string) => void;
  onPhoto: () => void;
  onCompose: () => void;
}) {
  const s = t.suggestions;
  const chips = [
    ...[s.today, s.overdue, s.steps].map((label) => ({
      label,
      icon: undefined,
      onClick: () => onPick(label),
    })),
    { label: s.photo, icon: <ImagePlusIcon aria-hidden="true" />, onClick: onPhoto },
    { label: copy.composer.open, icon: <PlusIcon aria-hidden="true" />, onClick: onCompose },
  ];
  return (
    <div className="my-auto flex flex-col items-center px-4 text-center">
      <MewStatic mood="happy" className="w-20" />
      <p className="mt-4 text-title-3 font-semibold">{t.emptyTitle}</p>
      <p className="mt-1 text-subhead text-ink-secondary">{t.emptyHint}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {chips.map((chip, i) => (
          <motion.span
            key={chip.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.soft, delay: CHIP_DELAY + i * CHIP_STAGGER }}
          >
            <Chip icon={chip.icon} onClick={chip.onClick}>
              {chip.label}
            </Chip>
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/** LGPD: nothing reaches OpenAI before this. */
function Consent({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="my-auto flex flex-col items-center px-4 py-6 text-center">
      <MewStatic className="w-20" />
      <p className="mt-4 text-title-3 font-semibold">{t.consentTitle}</p>
      <p className="mt-1 text-subhead text-ink-secondary">{t.consentBody}</p>
      <Button onClick={onAccept} className="mt-6">
        {t.consentAccept}
      </Button>
    </div>
  );
}
