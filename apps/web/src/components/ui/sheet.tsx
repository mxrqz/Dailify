import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";

import { OverlayClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Vidro que entra pela borda: `bottom` é a folha do iOS (topo de 32px + puxador), `left` a gaveta
 * do menu. Só `transform` anima, no próprio painel; overflow fica num filho (aqui cortaria o fio de
 * luz da borda de cima).
 */
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "glass text-ink fixed z-50 flex flex-col data-[state=open]:animate-in data-[state=open]:duration-slow data-[state=open]:ease-out data-[state=closed]:animate-out data-[state=closed]:duration-base data-[state=closed]:ease-exit",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full inset-y-0 right-0 h-full w-3/4 rounded-l-sheet sm:max-w-sm",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left-full data-[state=open]:slide-in-from-left-full inset-y-0 left-0 h-full w-76 max-w-5/6 rounded-r-sheet px-3 pt-4 pb-safe",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full inset-x-0 top-0 h-auto rounded-b-sheet",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full inset-x-0 bottom-0 h-auto rounded-t-sheet px-4 pb-safe",
          className,
        )}
        {...props}
      >
        {side === "bottom" && (
          <div
            className="mx-auto mt-2 h-1.25 w-9 shrink-0 rounded-full bg-fill-pressed"
            aria-hidden="true"
          />
        )}
        {children}
        {showCloseButton && (
          <OverlayClose
            plain={side !== "bottom"}
            className={side === "bottom" ? "top-4.5 right-3" : "top-4 right-3"}
          />
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 px-1 pt-3 pr-10 pb-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-1 pt-5", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-title-3 font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-ink-secondary text-subhead", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
