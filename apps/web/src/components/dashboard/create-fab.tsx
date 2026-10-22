import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Minimize2, Pin, PlusIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { TaskComposer, type ComposerValues } from "@/components/dashboard/task-composer";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { reveal, spring } from "@/consts/motion";
import { useStoredFlag } from "@/hooks/useStoredFlag";
import { cn } from "@/lib/utils";

const DOCKED_KEY = "dailify:composer-docked";
// Botão, folha e campo fixo são a MESMA superfície: o framer morfa uma na outra pelo layoutId.
const SURFACE = "composer-surface";

// Espelham rounded-2xl e --radius-panel. Têm que ser números: o framer só corrige o raio durante a
// escala do morph quando ele vem pelo style, não por classe.
const RADIUS_FAB = 16;
const RADIUS_PANEL = 22;

const iconButton =
  "flex size-7 cursor-pointer items-center justify-center rounded-full border border-highlight bg-surface-panel text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground";

interface CreateFabProps {
  onSubmit: (values: ComposerValues) => void;
  submitting?: boolean;
  /** Tela Sem data do mobile: o "+" cria sem data. */
  undatedOnly?: boolean;
}

/**
 * A criação, em dois modos lembrados por device: só o "+" que abre a folha, ou o campo sempre
 * aberto no rodapé do painel (largura toda). Sem portal de propósito: no desktop a folha se ancora
 * no próprio botão, que mora no painel da agenda e desliza com ele.
 */
export function CreateFab({ onSubmit, submitting, undatedOnly }: CreateFabProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useStoredFlag(DOCKED_KEY);
  // Desfixou: a folha fica aberta e some quando o mouse sai dela.
  const [closeOnLeave, setCloseOnLeave] = useState(false);
  const desktop = useMediaQuery("(min-width: 768px)");
  const reduce = useReducedMotion();
  const fabRef = useRef<HTMLButtonElement>(null);
  const label = undatedOnly ? copy.composer.openUndated : copy.composer.open;

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
      if (docked) document.getElementById("composer-text")?.focus();
      else setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [docked]);

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
    if (!next) setCloseOnLeave(false);
  };

  return (
    <LayoutGroup id="composer">
      {docked ? (
        // pb-16 no mobile: o campo para acima do indicador de páginas, que é fixed em bottom-6.
        <div className="sticky bottom-0 z-40 mt-auto px-4 pb-16 md:px-6 md:pb-6">
          <motion.section
            layoutId={SURFACE}
            transition={morph}
            style={{ borderRadius: RADIUS_PANEL }}
            aria-label={label}
            className="relative border border-highlight bg-surface-panel p-1 shadow-panel"
          >
            <motion.div {...content}>
              <TaskComposer
                submitting={submitting}
                undatedOnly={undatedOnly}
                onSubmit={(values) => onSubmit(values)}
              />
            </motion.div>
            <motion.button
              {...content}
              type="button"
              aria-label={copy.composer.minimize}
              onClick={unpin}
              className={cn(iconButton, "absolute -top-3.5 right-4")}
            >
              <Minimize2 className="size-3.5" aria-hidden="true" />
            </motion.button>
          </motion.section>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-40 h-0 md:sticky md:mt-auto">
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
              className="absolute right-4 bottom-4 flex size-12 cursor-pointer items-center justify-center bg-accent-primary text-primary-foreground shadow-fab transition-colors hover:bg-accent-hover md:right-6 md:bottom-6"
            >
              <motion.span {...content} className="flex">
                <PlusIcon className="size-5" strokeWidth={2.2} aria-hidden="true" />
              </motion.span>
            </motion.button>
          )}

          <Dialog open={open} onOpenChange={changeOpen}>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
                className="fixed inset-0 bg-surface-scrim md:hidden"
              />
            </DialogPrimitive.Overlay>
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
                  const field = document.getElementById("composer-text");
                  if (field instanceof HTMLInputElement && field.value) return;
                  changeOpen(false);
                }}
                style={
                  desktop
                    ? { borderRadius: RADIUS_PANEL }
                    : {
                        borderTopLeftRadius: RADIUS_PANEL,
                        borderTopRightRadius: RADIUS_PANEL,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                      }
                }
                className={cn(
                  "fixed inset-x-0 bottom-0 border-t border-highlight bg-surface-panel px-2 pt-2 pb-safe shadow-panel",
                  "md:absolute md:inset-x-auto md:right-6 md:bottom-6 md:w-sheet md:border md:p-1",
                )}
              >
                <DialogTitle className="sr-only">{label}</DialogTitle>
                <motion.div {...content}>
                  <TaskComposer
                    submitting={submitting}
                    undatedOnly={undatedOnly}
                    onSubmit={(values, again) => {
                      onSubmit(values);
                      if (!again) changeOpen(false);
                    }}
                  />
                </motion.div>
                <motion.button
                  {...content}
                  type="button"
                  aria-label={copy.composer.pin}
                  onClick={pin}
                  className={cn(iconButton, "absolute -top-3.5 right-4")}
                >
                  <Pin className="size-3.5" aria-hidden="true" />
                </motion.button>
              </motion.div>
            </DialogPrimitive.Content>
          </Dialog>
        </div>
      )}
    </LayoutGroup>
  );
}
