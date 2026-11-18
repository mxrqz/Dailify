import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { copy } from "@/components/kit/copy";
import { cn } from "@/lib/utils";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-overlay",
        className,
      )}
      {...props}
    />
  );
});

/**
 * O X dos overlays de vidro (dialog, sheet): alvo de 44px com o círculo `fill` de 30px dentro —
 * `fill` sobe um tom no vidro. `plain` tira o círculo (gaveta lateral).
 */
function OverlayClose({ className, plain }: { className?: string; plain?: boolean }) {
  return (
    <DialogPrimitive.Close
      className={cn(
        "absolute grid size-11 cursor-pointer place-items-center rounded-full text-ink-secondary focus-ring transition-colors hover:text-ink",
        className,
      )}
    >
      <span className={cn("grid size-7.5 place-items-center rounded-full", !plain && "bg-fill")}>
        <XIcon className={plain ? "size-5.5" : "size-4"} strokeWidth={plain ? 2 : 2.5} />
      </span>
      <span className="sr-only">{copy.close}</span>
    </DialogPrimitive.Close>
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      {/* Vidro: o fade e o zoom são do próprio painel, nunca de um ancestral (mataria o blur). */}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "glass text-ink data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-overlay grid w-full max-w-[calc(100%-2rem)] -translate-1/2 gap-4 rounded-lg p-6 duration-base ease-out sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && <OverlayClose className="top-2 right-2" />}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 px-7 text-center sm:pl-0 sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-title-3 font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-ink-secondary text-subhead font-normal", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  OverlayClose,
  DialogTitle,
  DialogTrigger,
};
