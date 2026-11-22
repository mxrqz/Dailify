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
  type MewRequest,
  type Task,
} from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { MEW_PANEL_SLOT, SidePanel } from "@/components/dashboard/side-panel";
import { Button } from "@/components/ui/button";
import { fade } from "@/consts/motion";
import {
  getSettings,
  mewChat,
  saveSettings,
  sendMewAction,
  setMewAction,
  transcribeMew,
} from "@/functions/api";
import { creditsLabel } from "@/functions/quota-label";
import { appTimeZone, zoned } from "@/functions/zone";
import { setCreditsTray } from "@/hooks/useCreditsTray";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { useOnline } from "@/hooks/useOnline";
import { useQuotas } from "@/hooks/useQuotas";
import { closePanel, openPanel, usePanel } from "@/hooks/usePanel";
import { useVoiceCreate, voiceSupported } from "@/hooks/useVoiceCreate";
import { useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { useMewApply } from "./apply";
import { copy as t } from "./copy";
import { ChatDrawer, ChatLog } from "./chat-drawer";
import { ChatInput, INPUT_ID } from "./chat-input";
import { CreateDock, DOCK_PILL } from "./dock";
import type { Photo } from "./photo";
import {
  type BoxBlock,
  type ChatAction,
  type Message,
  type PermissionBlock,
  type SendBlock,
  chatReducer,
  frozen,
  loadChat,
  mewId,
  saveChat,
} from "./thread";

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const historyOf = (messages: Message[]) =>
  messages
    .filter((m) => m.text)
    .slice(-MEW_HISTORY_MAX)
    .map((m) => ({ from: m.from, text: m.text.slice(0, MEW_TEXT_MAX) }));
const failure = (reply: string): MewReply => ({ reply, intent: "unsupported", blocks: [] });

/** The dock and the Mew chat it opens: one `/mew/chat` call per turn, boxes applied to the agenda. */
export function MewChat({
  onCompose,
  panel,
  listenSignal,
}: {
  onCompose: () => void;
  /** Desktop: the dock sits at the agenda's foot and the thread lives in the side panel. */
  panel?: boolean;
  /** Bumped by `?mew=voice` (the Android assistant): each new value opens the chat listening. */
  listenSignal?: number;
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

  const send = (text: string, image?: Photo) => {
    const id = newId();
    dispatch({ type: "send", id, text, image: image?.thumb });
    return ask(
      id,
      { text, timezone: appTimeZone(), image: image?.full, history: historyOf(messages) },
      image,
    );
  };

  const say = (line: string) => {
    const id = newId();
    dispatch({ type: "wait", id });
    dispatch({ type: "reply", to: mewId(id), reply: failure(line) });
  };

  // The mic: the transcript goes out as a normal turn, whose reply is the turn's one credit.
  const voice = useVoiceCreate(undefined, async (audio) => {
    const form = new FormData();
    form.append("audio", audio);
    const { text, error } = await transcribeMew(form);
    if (text) return void send(text);
    if (error?.code === API_ERROR.mewConsentRequired) return setConsent(false);
    const out = error?.code === API_ERROR.aiExhausted;
    if (out) setCreditsTray(true);
    say(
      !error
        ? t.heardNothing
        : error.offline
          ? t.offline
          : out
            ? copy.mew.exhausted
            : error.code === API_ERROR.rateLimited
              ? t.tooFast
              : t.heardFailed,
    );
  });
  const canListen = online && voiceSupported();
  const listen = () => {
    if (panel) openPanel({ kind: "mew" });
    else setDrawer(true);
    if (canListen) void voice.start();
  };
  const listenNow = useEffectEvent(listen);
  useEffect(() => {
    if (listenSignal) listenNow();
  }, [listenSignal]);

  /** One `/mew/chat` call into the typing reply `mewId(id)`; `false` = it failed. */
  const ask = async (id: string, req: MewRequest, image?: Photo) => {
    setBusy(true);
    try {
      const { reply, error } = await mewChat(req);
      if (reply) {
        // The re-sent half of a turn was paid with its first reply.
        if (!req.permission) bumpUsage("ai");
        dispatch({ type: "reply", to: mewId(id), reply });
        return true;
      }
      // A 403 or 429 means different things depending on the server's code.
      if (error?.code === API_ERROR.mewConsentRequired) {
        pending.current = { text: req.text, image };
        dispatch({ type: "drop", id });
        setConsent(false);
        return false;
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
      return false;
    } finally {
      setBusy(false);
    }
  };

  // "Permitir": the same turn again (my message, the history before it), now allowed to read.
  const resume = (block: PermissionBlock, always: boolean) => {
    let index = messages.findIndex(
      (m) => m.from === "mew" && m.blocks.some((b) => b.kind !== "tasks" && b.id === block.id),
    );
    while (index > 0 && messages[index].from !== "me") index--;
    const turn = messages[index];
    if (turn?.from !== "me") return;
    const id = newId();
    dispatch({ type: "wait", id });
    void ask(id, {
      text: turn.text,
      timezone: appTimeZone(),
      // The stored thumb: the full photo isn't kept.
      image: turn.image,
      history: historyOf(messages.slice(0, index)),
      permission: { id: block.id, always },
    }).then((ok) => ok || dispatch({ type: "settle", block: block.id, step: "draft" }));
  };

  const deliver = async (block: SendBlock) => {
    const { error } = await sendMewAction(block.id, block.text);
    if (!error) return;
    dispatch({ type: "settle", block: block.id, step: "draft" });
    toast.error(t.sendBox.error, { description: error.message });
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

  // The box buttons also write: confirm and undo through the agenda, allow and send through the
  // server, cancel to the audit row.
  const act = (action: ChatAction) => {
    dispatch(action);
    if (!("block" in action)) return;
    const block = messages
      .flatMap((m) => (m.from === "mew" ? m.blocks : []))
      .find((b): b is BoxBlock => b.kind !== "tasks" && b.id === action.block);
    if (!block) return;
    const draft = block.step === "draft";
    if (action.type === "cancel" && draft) void setMewAction(block.id, "cancelled");
    if (action.type === "allow" && draft && block.kind === "permission")
      resume(block, action.always);
    if (action.type === "deliver" && draft && block.kind === "send") void deliver(block);
    if (block.kind !== "confirm") return;
    if (action.type === "confirm" && draft)
      void apply(frozen(block), "do").then(
        (ok) => ok || dispatch({ type: "settle", block: block.id, step: "draft" }),
      );
    if (action.type === "undo" && block.step === "done")
      void apply(block, "undo").then(
        (ok) => ok || dispatch({ type: "settle", block: block.id, step: "done" }),
      );
  };

  const credits = creditsLabel(ai);

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
      busy={busy || voice.state === "sending"}
      offline={!online}
      onSend={(text, image) => {
        if (dock) openPanel({ kind: "mew" });
        void send(text, image);
      }}
      onVoice={canListen ? listen : undefined}
      listening={voice.state === "recording"}
      onStop={voice.stop}
      onCancel={voice.cancel}
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
      <CreateDock
        onOpen={() => setDrawer(true)}
        onVoice={canListen ? listen : undefined}
        chat={open && input()}
      />
      {/* The drawer is non-modal (the dock outside it must stay usable), so the scrim is ours. */}
      <AnimatePresence>
        {open && <motion.div {...fade} aria-hidden="true" className="fixed inset-0 z-chat scrim" />}
      </AnimatePresence>
      <ChatDrawer
        open={open}
        onOpenChange={(next) => {
          setDrawer(next);
          // Closed mid-recording, the mic would keep listening with nothing on screen to stop it.
          if (!next) voice.cancel();
        }}
        busy={busy}
        credits={credits}
        {...log}
      />
    </>
  );
}
