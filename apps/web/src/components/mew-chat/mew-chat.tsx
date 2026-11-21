import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SquarePenIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  API_ERROR,
  MEW_HISTORY_MAX,
  MEW_TEXT_MAX,
  type MewReply,
  type Task,
} from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { MEW_PANEL_SLOT, SidePanel } from "@/components/dashboard/side-panel";
import { Button } from "@/components/ui/button";
import { fade } from "@/consts/motion";
import { getSettings, mewChat, saveSettings, setMewAction } from "@/functions/api";
import { creditsLabel } from "@/functions/quota-label";
import { appTimeZone, zoned } from "@/functions/zone";
import { setCreditsTray } from "@/hooks/useCreditsTray";
import { useOnline } from "@/hooks/useOnline";
import { useQuotas } from "@/hooks/useQuotas";
import { closePanel, openPanel, usePanel } from "@/hooks/usePanel";
import { useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { useMewApply } from "./apply";
import { copy as t } from "./copy";
import { ChatDrawer, ChatLog } from "./chat-drawer";
import { ChatInput, INPUT_ID } from "./chat-input";
import { CreateDock, DOCK_PILL } from "./dock";
import type { Photo } from "./photo";
import {
  type ChatAction,
  type ConfirmBlock,
  chatReducer,
  frozen,
  loadChat,
  mewId,
  saveChat,
} from "./thread";

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const failure = (reply: string): MewReply => ({ reply, intent: "unsupported", blocks: [] });

/** The dock and the Mew chat it opens: one `/mew/chat` call per turn, boxes applied to the agenda. */
export function MewChat({
  onCompose,
  onVoice,
  panel,
}: {
  onCompose: () => void;
  onVoice?: () => void;
  /** Desktop: the dock sits at the agenda's foot and the thread lives in the side panel. */
  panel?: boolean;
}) {
  const userId = useSession().data?.user.id;
  const [messages, dispatch] = useReducer(chatReducer, userId, loadChat);
  const [drawer, setDrawer] = useState(false);
  const inPanel = usePanel()?.kind === "mew";
  const open = panel ? inPanel : drawer;
  // PanelHost renders the slot in the same commit; the panel goes there once it is in the DOM.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setSlot(panel && inPanel ? document.getElementById(MEW_PANEL_SLOT) : null);
  }, [panel, inPanel]);
  // One input at a time: opening the panel moves the typing from the dock to its footer.
  useEffect(() => {
    if (slot) document.getElementById(INPUT_ID)?.focus();
  }, [slot]);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState<boolean>();
  // The send the consent card interrupted; it goes out once accepted.
  const pending = useRef<{ text: string; image?: Photo }>();
  const photo = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const ai = useQuotas().states.ai;
  const { bumpUsage, goToDay } = useDailify();
  const apply = useMewApply();

  // Once per finished turn (and per tap after it), not while a reply is in flight.
  useEffect(() => {
    if (!busy && userId) saveChat(userId, messages);
  }, [busy, messages, userId]);

  useEffect(() => {
    if (!open || consent !== undefined) return;
    void getSettings().then(({ settings }) => {
      if (settings) setConsent(settings.mewConsent);
    });
  }, [open, consent]);

  const send = async (text: string, image?: Photo) => {
    const id = newId();
    const history = messages
      .filter((m) => m.text)
      .slice(-MEW_HISTORY_MAX)
      .map((m) => ({ from: m.from, text: m.text.slice(0, MEW_TEXT_MAX) }));
    dispatch({ type: "send", id, text, image: image?.thumb });
    setBusy(true);
    try {
      const { reply, error } = await mewChat({
        text,
        timezone: appTimeZone(),
        image: image?.full,
        history,
      });
      if (reply) {
        bumpUsage("ai");
        dispatch({ type: "reply", to: mewId(id), reply });
        return;
      }
      // A 403 or 429 means different things depending on the server's code.
      if (error?.code === API_ERROR.mewConsentRequired) {
        pending.current = { text, image };
        dispatch({ type: "drop", id });
        setConsent(false);
        return;
      }
      const out = error?.code === API_ERROR.aiExhausted;
      if (out) setCreditsTray(true);
      const line = out
        ? copy.mew.exhausted
        : error?.code === API_ERROR.rateLimited
          ? t.tooFast
          : error?.status === 413
            ? t.tooBig
            : t.failed;
      dispatch({ type: "reply", to: mewId(id), reply: failure(line) });
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    const { error } = await saveSettings({ mewConsent: true });
    if (error) {
      toast.error(t.consentError, { description: error.message });
      return;
    }
    setConsent(true);
    const retry = pending.current;
    pending.current = undefined;
    if (retry) void send(retry.text, retry.image);
  };

  // The box buttons also write: confirm and undo through the agenda, cancel to the audit row.
  const act = (action: ChatAction) => {
    dispatch(action);
    if (action.type !== "confirm" && action.type !== "undo" && action.type !== "cancel") return;
    const block = messages
      .flatMap((m) => (m.from === "mew" ? m.blocks : []))
      .find((b): b is ConfirmBlock => b.kind === "confirm" && b.id === action.block);
    if (action.type === "cancel" && block?.step === "draft")
      void setMewAction(block.id, "cancelled");
    if (action.type === "confirm" && block?.step === "draft")
      void apply(frozen(block), "do").then(
        (ok) => ok || dispatch({ type: "settle", block: block.id, step: "draft" }),
      );
    if (action.type === "undo" && block?.step === "done")
      void apply(block, "undo").then(
        (ok) => ok || dispatch({ type: "settle", block: block.id, step: "done" }),
      );
  };

  const credits = creditsLabel(ai);

  const voice =
    onVoice &&
    (() => {
      setDrawer(false);
      onVoice();
    });

  const log = {
    messages,
    dispatch: act,
    consent,
    onConsent: () => void accept(),
    onSend: (text: string) => void send(text),
    onPhoto: () => photo.current?.click(),
    onCompose: () => {
      setDrawer(false);
      onCompose();
    },
    // Desktop keeps the panel open beside the agenda it scrolls.
    onOpenTask: (task: Task) => {
      setDrawer(false);
      void goToDay(task.undated ? zoned() : zoned(task.date));
    },
  };

  const input = (dock?: boolean) => (
    <ChatInput
      dock={dock}
      busy={busy}
      offline={!online}
      onSend={(text, image) => {
        if (dock) openPanel({ kind: "mew" });
        void send(text, image);
      }}
      onVoice={voice}
      file={photo}
    />
  );

  if (panel)
    return (
      <>
        {!inPanel && (
          <CreateDock inline onOpen={() => openPanel({ kind: "mew" })} chat={input(true)} />
        )}
        {inPanel &&
          slot &&
          createPortal(
            <SidePanel
              title={copy.panel.mew}
              onClose={closePanel}
              actions={
                <>
                  <p aria-live="polite" className="sr-only">
                    {busy ? t.thinking : ""}
                  </p>
                  {credits !== null && (
                    <span className="text-footnote text-ink-secondary tabular-nums">{credits}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.clear}
                    onClick={() => dispatch({ type: "clear" })}
                  >
                    <SquarePenIcon aria-hidden="true" />
                  </Button>
                </>
              }
              footer={<div className={cn(DOCK_PILL, "flex-1 pl-1")}>{input()}</div>}
            >
              <ChatLog {...log} panel />
            </SidePanel>,
            slot,
          )}
      </>
    );

  return (
    <>
      {/* Open, the dock is the chat's message box, above the drawer. */}
      <CreateDock onOpen={() => setDrawer(true)} onVoice={onVoice} chat={open && input()} />
      {/* The drawer is non-modal (the dock outside it must stay usable), so the scrim is ours. */}
      <AnimatePresence>
        {open && <motion.div {...fade} aria-hidden="true" className="fixed inset-0 z-chat scrim" />}
      </AnimatePresence>
      <ChatDrawer open={open} onOpenChange={setDrawer} busy={busy} credits={credits} {...log} />
    </>
  );
}
