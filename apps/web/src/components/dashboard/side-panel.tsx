import { useEffect, type ReactNode } from "react";
import { XIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { weekdayDate } from "@/functions/date-label";
import { zoned } from "@/functions/zone";
import { closePanel, usePanel, type PanelState } from "@/hooks/usePanel";
import { cn } from "@/lib/utils";

/** The toolbar toggle's `aria-controls`. */
export const SIDE_PANEL_ID = "side-panel";
/** The "mew" kind's mount point: `MewChat` owns the thread (alive while closed) and portals its panel here. */
export const MEW_PANEL_SLOT = "mew-panel-slot";

/**
 * The desktop side panel: glass, header (title, actions, close), a scrolling body and an optional
 * footer. From `xl` it is a column that pushes the agenda; below, it overlays the right edge.
 */
export function SidePanel({
  title,
  actions,
  footer,
  onClose,
  children,
}: {
  title: string;
  /** Icon buttons between the title and the close (`size="icon-sm"`). */
  actions?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}): JSX.Element {
  return (
    <aside
      id={SIDE_PANEL_ID}
      aria-label={title}
      className={cn(
        "glass fixed inset-y-0 right-0 z-float flex h-dvh w-side shrink-0 flex-col border-l border-separator shadow-raised",
        "xl:sticky xl:top-0 xl:z-auto xl:shadow-none",
        "transition-[translate,opacity] duration-base ease-out starting:translate-x-4 starting:opacity-0 motion-reduce:transition-none",
      )}
    >
      <header className="flex h-13 shrink-0 items-center gap-1.5 pr-2.5 pl-5">
        <h2 className="min-w-0 flex-1 truncate text-subhead font-semibold">{title}</h2>
        {actions}
        <Button variant="ghost" size="icon-sm" aria-label={copy.panel.close} onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-1 pb-6">
        {children}
      </div>
      {footer && (
        <footer className="flex shrink-0 items-center gap-2 border-t border-separator px-5 pt-3 pb-5">
          {footer}
        </footer>
      )}
    </aside>
  );
}

const titleOf = (panel: PanelState): string =>
  panel.kind === "task"
    ? copy.panel.task
    : panel.kind === "mew"
      ? copy.panel.mew
      : weekdayDate(zoned(panel.day), "EEEE, d 'de' MMMM");

/** The panel wired to `usePanel`: Esc closes it, and each `kind` picks its content. */
export function PanelHost(): JSX.Element | null {
  const panel = usePanel();
  const open = panel !== null;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // A dialog or menu over the panel takes this Esc for itself.
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"]')) return;
      closePanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!panel) return null;
  if (panel.kind === "mew") return <div id={MEW_PANEL_SLOT} className="contents" />;
  // ponytail: every kind renders an empty body; the task, Mew and day phases fill them here.
  return <SidePanel title={titleOf(panel)} onClose={closePanel} />;
}
