import { type FormEvent, type RefObject, useState } from "react";
import { ArrowUpIcon, ImagePlusIcon, MicIcon, XIcon } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { MEW_IMAGE_MAX, MEW_TEXT_MAX } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { spring } from "@/consts/motion";
import { cn } from "@/lib/utils";

import { DockButton } from "./dock";
import { type Photo, photoOf } from "./photo";

const t = copy.mewChat;
export const INPUT_ID = "mew-input";

/**
 * The dock's pill while the chat is open (`CreateDock chat={…}`): attach, field and one round
 * button that is the mic when empty (opens the voice composer) and send with text.
 */
export function ChatInput({
  busy,
  offline,
  onSend,
  onVoice,
  file,
}: {
  busy: boolean;
  offline: boolean;
  onSend: (text: string, image?: Photo) => void;
  onVoice?: () => void;
  file: RefObject<HTMLInputElement>;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<Photo>();
  const filled = !!text.trim() || !!image;
  const mic = !filled && !!onVoice;

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
    <form onSubmit={submit} className="flex h-full min-w-0 flex-1 items-center gap-1">
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
      <Button
        variant="ghost"
        size="icon"
        aria-label={t.attach}
        onClick={() => file.current?.click()}
        className="rounded-full text-ink-secondary hover:text-ink"
      >
        <ImagePlusIcon aria-hidden="true" />
      </Button>
      {/* text-body: below 16px iOS zooms the page on focus. */}
      <input
        id={INPUT_ID}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={offline ? t.offline : t.placeholder}
        aria-label={t.placeholder}
        maxLength={MEW_TEXT_MAX}
        enterKeyHint="send"
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-secondary"
      />
      <DockButton
        type={mic ? "button" : "submit"}
        aria-label={mic ? t.mic : t.send}
        disabled={!mic && (busy || offline || !filled)}
        onClick={mic ? onVoice : undefined}
        className={cn(filled && "bg-brand text-on-brand")}
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
