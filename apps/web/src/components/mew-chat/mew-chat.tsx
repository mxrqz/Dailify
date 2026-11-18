import { useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { API_ERROR, MEW_HISTORY_MAX, MEW_TEXT_MAX, type MewReply } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { fade } from "@/consts/motion";
import { getSettings, mewChat, saveSettings, setMewAction } from "@/functions/api";
import { creditsLabel } from "@/functions/quota-label";
import { appTimeZone, zoned } from "@/functions/zone";
import { useOnline } from "@/hooks/useOnline";
import { useQuotas } from "@/hooks/useQuotas";
import { useSession } from "@/lib/auth";

import { useMewApply } from "./apply";
import { ChatDrawer } from "./chat-drawer";
import { ChatInput } from "./chat-input";
import { CreateDock } from "./dock";
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

const t = copy.mewChat;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const failure = (reply: string): MewReply => ({ reply, intent: "unsupported", blocks: [] });

/** The mobile dock and the Mew chat it opens: one `/mew/chat` call per turn, boxes applied to the agenda. */
export function MewChat({ onCompose, onVoice }: { onCompose: () => void; onVoice?: () => void }) {
  const userId = useSession().data?.user.id;
  const [messages, dispatch] = useReducer(chatReducer, userId, loadChat);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState<boolean>();
  // The send the consent card interrupted; it goes out once accepted.
  const pending = useRef<{ text: string; image?: Photo }>();
  const photo = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const ai = useQuotas().states.ai;
  const { bumpUsage, goToDay } = useDailify();
  const apply = useMewApply();
  const navigate = useNavigate();

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
      if (out)
        toast(copy.mew.exhausted, {
          description: copy.voice.limitReachedHint,
          action: { label: copy.mew.upgrade, onClick: () => navigate("/premium") },
        });
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
      setOpen(false);
      onVoice();
    });

  return (
    <>
      {/* Open, the dock is the chat's message box, above the drawer. */}
      <CreateDock
        onOpen={() => setOpen(true)}
        onVoice={onVoice}
        chat={
          open && (
            <ChatInput
              busy={busy}
              offline={!online}
              onSend={(text, image) => void send(text, image)}
              onVoice={voice}
              file={photo}
            />
          )
        }
      />
      {/* The drawer is non-modal (the dock outside it must stay usable), so the scrim is ours. */}
      <AnimatePresence>
        {open && <motion.div {...fade} aria-hidden="true" className="fixed inset-0 z-chat scrim" />}
      </AnimatePresence>
      <ChatDrawer
        open={open}
        onOpenChange={setOpen}
        messages={messages}
        dispatch={act}
        busy={busy}
        credits={credits}
        consent={consent}
        onConsent={() => void accept()}
        onSend={(text) => void send(text)}
        onPhoto={() => photo.current?.click()}
        onCompose={() => {
          setOpen(false);
          onCompose();
        }}
        onOpenTask={(task) => {
          setOpen(false);
          void goToDay(task.undated ? zoned() : zoned(task.date));
        }}
      />
    </>
  );
}
