import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Minimize2Icon, PinIcon, PlusIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import {
  COMPOSER_TEXT_ID,
  TaskComposer,
  type ComposerValues,
} from "@/components/dashboard/task-composer";
import { MewChat } from "@/components/mew-chat/mew-chat";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useOnline } from "@/hooks/useOnline";
import { voiceSupported } from "@/hooks/useVoiceCreate";
import { reveal, spring } from "@/consts/motion";
import { useStoredFlag } from "@/hooks/useStoredFlag";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { cn } from "@/lib/utils";

const DOCKED_KEY = "dailify:composer-docked";
// Botão, folha e campo fixo são a MESMA superfície: o framer morfa uma na outra pelo layoutId.
const SURFACE = "composer-surface";

// px of --radius-md (14: rounded-lg's 22 would make the 48px FAB nearly a circle) and --radius-panel
// (22, so the inner rounded-field stays concentric). Numbers, because motion only corrects a radius
// during the morph's scale when it comes through `style`.
const RADIUS_FAB = 14;
const RADIUS_PANEL = 22;

const iconButton =
  "flex size-7 cursor-pointer items-center justify-center rounded-md border border-separator bg-surface-raised text-ink-secondary transition-colors duration-fast hover:bg-fill hover:text-ink";

interface CreateFabProps {
  /** `false`: não criou — a folha reabre com o texto. */
  onSubmit: (values: ComposerValues) => Promise<boolean>;
  submitting?: boolean;
  /** Dia vindo do calendário: abre a criação já nele. */
  day?: Date | null;
  onDayDone?: () => void;
}

/**
 * A criação. No mobile, o dock fixo embaixo abre o chat da Mew (que tem "Nova tarefa" pra esta
 * folha) e o mic abre a folha já gravando. No desktop, dois modos lembrados por device: só o "+"
 * que abre a folha, ou o campo sempre aberto no rodapé do painel. Sem portal de propósito: lá a folha se ancora no próprio botão, que mora no
 * painel da agenda e desliza com ele.
 */
export function CreateFab({ onSubmit, submitting, day, onDayDone }: CreateFabProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 768px)");
  const [pinned, setDocked] = useStoredFlag(DOCKED_KEY);
  const docked = pinned && desktop;
  // Aberta pelo mic do dock: a folha já nasce gravando.
  const [listen, setListen] = useState(false);
  const online = useOnline();
  // Desfixou: a folha fica aberta e some quando o mouse sai dela.
  const [closeOnLeave, setCloseOnLeave] = useState(false);
  // A folha fecha no ⏎ (a tarefa já entrou otimista); se o servidor recusar, reabre com o texto.
  const [retry, setRetry] = useState<string>();
  const reduce = useReducedMotion();
  const fabRef = useRef<HTMLButtonElement>(null);
  const label = copy.composer.open;

  const morph = reduce ? { duration: 0 } : spring.soft;
  // O conteúdo só aparece depois que a superfície já tomou forma, e sai antes de ela encolher.
  const content = reduce ? { initial: false } : reveal;

  // "n" e "/" abrem a folha de qualquer lugar da página, menos de quem já está escrevendo ou de
  // outro diálogo ou menu aberto.
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
      if (docked) document.getElementById(COMPOSER_TEXT_ID)?.focus();
      else setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [docked]);

  // Só o `day` reabre: fixar ou desfixar com um dia pendente não mexe na folha.
  const openForDay = useEffectEvent(() => {
    if (!docked) setOpen(true);
  });
  useEffect(() => {
    if (!day) return;
    openForDay();
    // Depois do frame: a folha ainda está montando e o popover do calendário acabou de fechar.
    const frame = requestAnimationFrame(() => document.getElementById(COMPOSER_TEXT_ID)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [day]);

  const pin = () => {
    setDocked(true);
    setOpen(false);
  };

  const unpin = () => {
    setDocked(false);
    setOpen(true);
    setCloseOnLeave(true);
  };

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setRetry(undefined);
      setListen(false);
      setCloseOnLeave(false);
      onDayDone?.();
    }
  };

  // A folha fecha no ⏎ (a tarefa já entrou otimista); ⇧⏎ a mantém aberta pra próxima.
  const sheetComposer = (
    <TaskComposer
      large={!desktop}
      listen={listen}
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

  if (!desktop)
    return (
      <>
        {/* ponytail: the chat has no transcription route, so the mic still opens the voice composer. */}
        <MewChat
          onCompose={() => changeOpen(true)}
          onVoice={
            online && voiceSupported()
              ? () => {
                  setListen(true);
                  setOpen(true);
                }
              : undefined
          }
        />
        <Sheet open={open} onOpenChange={changeOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            aria-describedby={undefined}
            // Pelo mic, sem teclado: o foco fica na folha. Senão, direto no campo.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              if (!listen) document.getElementById(COMPOSER_TEXT_ID)?.focus();
            }}
            className="px-5"
          >
            <SheetTitle className="sr-only">{label}</SheetTitle>
            {sheetComposer}
          </SheetContent>
        </Sheet>
      </>
    );

  return (
    <LayoutGroup id="composer">
      {docked ? (
        <div className="sticky bottom-0 z-dock mt-auto px-6 pb-6">
          <motion.section
            layoutId={SURFACE}
            transition={morph}
            style={{ borderRadius: RADIUS_PANEL }}
            aria-label={label}
            className="relative border border-separator bg-surface-raised p-1 shadow-raised"
          >
            <motion.div {...content}>
              <TaskComposer
                day={day}
                onCreated={onDayDone}
                submitting={submitting}
                onSubmit={(values) => {
                  onDayDone?.();
                  return onSubmit(values);
                }}
              />
            </motion.div>
            <motion.button
              {...content}
              type="button"
              aria-label={copy.composer.minimize}
              onClick={unpin}
              className={cn(iconButton, "absolute -top-3.5 right-4")}
            >
              <Minimize2Icon className="size-3.5" aria-hidden="true" />
            </motion.button>
          </motion.section>
        </div>
      ) : (
        <div className="sticky bottom-0 z-dock mt-auto h-0">
          {!open && (
            <motion.button
              ref={fabRef}
              layoutId={SURFACE}
              transition={morph}
              style={{ borderRadius: RADIUS_FAB }}
              type="button"
              aria-label={label}
              onClick={() => changeOpen(true)}
              whileTap={reduce ? undefined : { scale: 0.96 }}
              className="absolute right-6 bottom-6 flex size-12 cursor-pointer items-center justify-center bg-brand text-on-brand transition-colors duration-fast hover:bg-brand-pressed"
            >
              <motion.span {...content} className="flex">
                <PlusIcon className="size-5" strokeWidth={2.2} aria-hidden="true" />
              </motion.span>
            </motion.button>
          )}

          <Dialog open={open} onOpenChange={changeOpen}>
            <DialogPrimitive.Content
              asChild
              aria-describedby={undefined}
              // O "+" volta a existir só depois do fechamento; o foco vai pra ele, não pro body.
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                requestAnimationFrame(() => fabRef.current?.focus());
              }}
            >
              <motion.div
                layoutId={SURFACE}
                transition={morph}
                // Texto pela metade segura a folha: sair com o mouse não pode jogar fora o que foi digitado.
                onPointerLeave={(event) => {
                  if (!closeOnLeave || event.pointerType !== "mouse") return;
                  const field = document.getElementById(COMPOSER_TEXT_ID);
                  if (field instanceof HTMLTextAreaElement && field.value) return;
                  changeOpen(false);
                }}
                style={{ borderRadius: RADIUS_PANEL }}
                className="absolute right-6 bottom-6 w-sheet border border-separator bg-surface-raised p-1 shadow-raised"
              >
                <DialogTitle className="sr-only">{label}</DialogTitle>
                <motion.div {...content}>{sheetComposer}</motion.div>
                <motion.button
                  {...content}
                  type="button"
                  aria-label={copy.composer.pin}
                  onClick={pin}
                  className={cn(iconButton, "absolute -top-3.5 right-4")}
                >
                  <PinIcon className="size-3.5" aria-hidden="true" />
                </motion.button>
              </motion.div>
            </DialogPrimitive.Content>
          </Dialog>
        </div>
      )}
    </LayoutGroup>
  );
}
