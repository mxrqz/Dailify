import { useEffect, useState } from "react";

import { copy } from "@/components/dashboard/copy";
import {
  COMPOSER_TEXT_ID,
  TaskComposer,
  type ComposerValues,
} from "@/components/dashboard/task-composer";
import { INPUT_ID } from "@/components/mew-chat/chat-input";
import { MewChat } from "@/components/mew-chat/mew-chat";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DESKTOP } from "@/consts/media";

interface CreateFabProps {
  /** `false`: não criou — a folha reabre com o texto. */
  onSubmit: (values: ComposerValues) => Promise<boolean>;
  submitting?: boolean;
  /** Dia vindo do calendário: abre a criação já nele. */
  day?: Date | null;
  /** Text handed in (the first-run example): opens the composer already holding it. */
  text?: string | null;
  /** The sheet closed or created: `day` and `text` were consumed. */
  onDayDone?: () => void;
  /** Bumped by the desktop toolbar's "Nova tarefa": each new value opens the composer. */
  openSignal?: number;
  /** Bumped by `?mew=voice` (the Android assistant): each new value opens the Mew chat listening. */
  voiceSignal?: number;
}

/**
 * A criação. O dock da Mew abre o chat (mobile: a gaveta; desktop: o painel lateral); its mic
 * records a chat turn. A folha é uma bottom sheet no mobile e um Dialog centrado no desktop, aberto
 * pelo "Nova tarefa" da toolbar ou pelo `n`.
 */
export function CreateFab({
  onSubmit,
  submitting,
  day,
  text,
  onDayDone,
  openSignal,
  voiceSignal,
}: CreateFabProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery(DESKTOP);
  // Swapping Sheet and Dialog remounts the composer and drops its draft: an open one keeps its shell.
  const [shell, setShell] = useState(desktop);
  if (!open && shell !== desktop) setShell(desktop);
  // A folha fecha no ⏎ (a tarefa já entrou otimista); se o servidor recusar, reabre com o texto.
  const [retry, setRetry] = useState<string>();
  const label = copy.composer.open;

  // "n" e "/" de qualquer lugar da página, menos de quem já está escrevendo ou de outro diálogo ou
  // menu aberto. No desktop, "/" é do campo da Mew (o dock, ou o painel dela aberto).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" && event.key !== "n") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing || event.repeat)
        return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"]')) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input,textarea,select"))
      )
        return;

      event.preventDefault();
      if (desktop && event.key === "/") document.getElementById(INPUT_ID)?.focus();
      else setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [desktop]);

  useEffect(() => {
    if (!day) return;
    setOpen(true);
    // Depois do frame: a folha ainda está montando e o popover do calendário acabou de fechar.
    const frame = requestAnimationFrame(() => document.getElementById(COMPOSER_TEXT_ID)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [day]);

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!text) return;
    setRetry(text);
    setOpen(true);
    const frame = requestAnimationFrame(() => document.getElementById(COMPOSER_TEXT_ID)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [text]);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setRetry(undefined);
      onDayDone?.();
    }
  };

  // A folha fecha no ⏎ (a tarefa já entrou otimista); ⇧⏎ a mantém aberta pra próxima.
  const composer = (
    <TaskComposer
      large={!shell}
      initialText={retry}
      day={day}
      onCreated={() => changeOpen(false)}
      onCancel={() => changeOpen(false)}
      submitting={submitting}
      onSubmit={(values, again) => {
        const created = onSubmit(values);
        if (!again) {
          changeOpen(false);
          void created.then((ok) => {
            if (ok) return;
            setRetry(values.text);
            setOpen(true);
          });
        }
        return created;
      }}
    />
  );

  const focusField = (event: Event) => {
    event.preventDefault();
    document.getElementById(COMPOSER_TEXT_ID)?.focus();
  };

  return (
    <>
      <MewChat panel={desktop} onCompose={() => changeOpen(true)} listenSignal={voiceSignal} />
      {shell ? (
        <Dialog open={open} onOpenChange={changeOpen}>
          <DialogContent
            aria-describedby={undefined}
            onOpenAutoFocus={focusField}
            className="gap-4 px-5 pt-4 pb-5 sm:max-w-150"
          >
            <DialogTitle className="pr-10">{label}</DialogTitle>
            {composer}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={changeOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            aria-describedby={undefined}
            onOpenAutoFocus={focusField}
            className="px-5"
          >
            <SheetTitle className="sr-only">{label}</SheetTitle>
            {composer}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
