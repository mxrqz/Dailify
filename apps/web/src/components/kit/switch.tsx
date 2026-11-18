import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Liga/desliga do iOS (51×31) em `ink` quando ligado. Sem rótulo visível próprio: dentro de uma
 * `ListRow`, passe o mesmo texto da linha em `aria-label`.
 */
export const Switch = forwardRef<
  HTMLButtonElement,
  Omit<ComponentPropsWithoutRef<"button">, "onChange"> & {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }
>(function Switch({ checked, onCheckedChange, onClick, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
      className={cn(
        "group/switch relative hit-target inline-flex h-7.75 w-12.75 flex-none cursor-pointer items-center rounded-full bg-fill-pressed p-0.5 outline-none transition-colors duration-base focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50 aria-checked:bg-ink",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="size-6.75 rounded-full bg-ink-secondary transition-[translate,background-color] duration-base ease-out group-aria-checked/switch:translate-x-5 group-aria-checked/switch:bg-canvas"
      />
    </button>
  );
});
