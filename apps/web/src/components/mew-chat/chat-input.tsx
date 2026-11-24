import { type FormEvent, type RefObject, useState } from "react";
import { ArrowUpIcon, ImagePlusIcon, MicIcon, SquareIcon, XIcon } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { MEW_IMAGE_MAX, MEW_TEXT_MAX } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { MewStatic } from "@/components/mew/mew-static";
import { Button } from "@/components/ui/button";
import { TOUCH } from "@/consts/media";
import { spring } from "@/consts/motion";
import { cn } from "@/lib/utils";

import { copy as t } from "./copy";
import { DockButton } from "./dock";
import { type Photo, photoOf } from "./photo";

export const INPUT_ID = "mew-input";

/**
 * The dock's pill while the chat is open (`CreateDock chat={…}`): attach, field and one round
 * button that is the mic when empty (records a spoken turn) and send with text. `dock`: the
 * desktop agenda dock, where the cat leads instead of attach and `/` is the shortcut. `listening`:
 * the mic is recording; the round button stops and sends, the leading one cancels.
 */
export function ChatInput({
  busy,
  offline,
  onSend,
  onVoice,
  listening,
  onStop,
  onCancel,
  file,
  dock,
  quiet,
}: {
  busy: boolean;
  offline: boolean;
  /** A send draft is open in the thread: the round button stays neutral, its Enviar is the red. */
  quiet?: boolean;
  onSend: (text: string, image?: Photo) => void;
  onVoice?: () => void;
  listening?: boolean;
  onStop?: () => void;
  onCancel?: () => void;
  file: RefObject<HTMLInputElement>;
  dock?: boolean;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<Photo>();
  const filled = !!text.trim() || !!image;
  const mic = !filled && !!onVoice;

  if (listening)
    return (
      <div className="flex h-full min-w-0 flex-1 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={copy.voice.cancel}
          onClick={onCancel}
          className="rounded-full text-ink-secondary hover:text-ink"
        >
          <XIcon aria-hidden="true" />
        </Button>
        <p aria-live="polite" className="min-w-0 flex-1 truncate text-body text-ink-secondary">
          {copy.voice.listening}
        </p>
        <DockButton aria-label={t.micStop} onClick={onStop} className="bg-brand text-on-brand">
          <SquareIcon aria-hidden="true" className="size-4 fill-current" />
        </DockButton>
      </div>
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || offline || !filled) return;
    onSend(text.trim(), image);
    setText("");
    setImage(undefined);
  };

  const pick = async (picked: File) => {
    const photo = await photoOf(picked).catch(() => undefined);
    if (!photo) return;
    if (photo.full.length > MEW_IMAGE_MAX) toast.error(t.tooBig);
    else setImage(photo);
  };

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 items-end gap-1 self-stretch py-1">
      {image && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.soft}
          className="absolute bottom-full left-1 mb-3"
        >
          <img
            src={image.thumb}
            alt={t.photo}
            className="h-16 rounded-md object-cover shadow-raised"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.removeImage}
            onClick={() => setImage(undefined)}
            className="absolute -top-5 -right-5 rounded-full hover:bg-transparent"
          >
            <span className="grid size-6 place-items-center rounded-full bg-ink text-canvas">
              <XIcon aria-hidden="true" className="size-3.5" />
            </span>
          </Button>
        </motion.div>
      )}
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (picked) void pick(picked);
        }}
      />
      {dock ? (
        <MewStatic className="mb-2 ml-2 w-7 flex-none" />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.attach}
          onClick={() => file.current?.click()}
          className="rounded-full text-ink-secondary hover:text-ink"
        >
          <ImagePlusIcon aria-hidden="true" />
        </Button>
      )}
      {/* text-body: below 16px iOS zooms the page on focus. Grows with its text (field-sizing). */}
      <textarea
        id={INPUT_ID}
        rows={1}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={offline ? t.offline : dock ? copy.composer.dock : t.placeholder}
        aria-label={dock ? t.open : t.placeholder}
        aria-keyshortcuts={dock ? "/" : undefined}
        maxLength={MEW_TEXT_MAX}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          if (window.matchMedia(TOUCH).matches) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
        autoComplete="off"
        className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-body text-ink outline-none field-sizing-content placeholder:text-ink-secondary"
      />
      {dock && !filled && (
        <kbd
          aria-hidden="true"
          className="mb-3 grid h-5 min-w-5 place-items-center rounded-xs bg-fill-pressed px-1 text-xs font-medium text-ink-secondary"
        >
          /
        </kbd>
      )}
      <DockButton
        type={mic ? "button" : "submit"}
        aria-label={mic ? t.mic : t.send}
        disabled={busy || (!mic && (offline || !filled))}
        onClick={mic ? onVoice : undefined}
        className={cn(quiet ? "bg-fill text-ink" : filled && "bg-brand text-on-brand")}
      >
        <MicIcon
          aria-hidden="true"
          className={cn(
            "absolute size-5 transition-[opacity,scale] duration-fast",
            !mic && "scale-60 opacity-0",
          )}
        />
        <ArrowUpIcon
          aria-hidden="true"
          className={cn(
            "absolute size-5 transition-[opacity,scale] duration-fast",
            mic && "scale-60 opacity-0",
          )}
        />
      </DockButton>
    </form>
  );
}
