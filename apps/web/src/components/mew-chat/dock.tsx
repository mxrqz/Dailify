import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { MicIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { MewStatic } from "@/components/mew/mew-static";
import { cn } from "@/lib/utils";

import { copy as mewChatCopy } from "./copy";

/** The dock's round ink button: the mic, and the chat's send. */
export function DockButton({
  className,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button">): JSX.Element {
  return (
    <button
      type={type}
      className={cn(
        "relative grid size-11 flex-none cursor-pointer place-items-center rounded-full bg-ink text-canvas transition-[background-color,color,scale] duration-fast active:scale-95 disabled:cursor-default disabled:bg-fill-pressed disabled:text-ink-tertiary",
        className,
      )}
      {...props}
    />
  );
}

/**
 * O dock do mobile: pílula fixa embaixo com o "Ei Mewki, anota…" (abre o chat da Mew) e o mic
 * (abre já gravando). Um espaçador do mesmo tamanho no fluxo deixa a última tarefa rolar acima dele.
 * Mora num portal no `body`, na camada `z-dock`: acima do chat da Mew, abaixo das folhas e da gaveta.
 * Com `chat`, a mesma pílula vira a caixa de mensagem do chat aberto por baixo dela.
 */
export function CreateDock({
  onOpen,
  onVoice,
  chat,
  className,
}: {
  onOpen: () => void;
  onVoice?: () => void;
  chat?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <>
      <div aria-hidden="true" className="pb-dock">
        <div className="h-13" />
      </div>
      {/* Sem barra sólida: véu leve atrás da pílula (blur + aresta cromática no fim da tela). */}
      {createPortal(
        <div
          data-chat={chat ? "" : undefined}
          className={cn(
            "dock-veil pointer-events-none fixed inset-x-0 bottom-0 z-dock px-4 pb-dock",
            className,
          )}
        >
          <div
            data-slot="create-dock"
            className={cn(
              "pointer-events-auto relative flex h-13 items-center gap-2.5 rounded-full bg-surface-raised pr-1 pl-2.5 shadow-raised outline-1 -outline-offset-1 outline-card-edge dark:bg-fill dark:outline-fill-pressed",
              chat && "pl-1",
            )}
          >
            {chat || (
              <>
                <button
                  type="button"
                  aria-label={mewChatCopy.open}
                  onClick={onOpen}
                  className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left outline-none"
                >
                  <MewStatic className="ml-0.5 w-7 flex-none" />
                  <span className="truncate text-body text-ink-secondary">
                    {copy.composer.dock}
                  </span>
                </button>
                {onVoice && (
                  <DockButton aria-label={copy.composer.dockVoice} onClick={onVoice}>
                    <MicIcon aria-hidden="true" className="size-5" />
                  </DockButton>
                )}
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
