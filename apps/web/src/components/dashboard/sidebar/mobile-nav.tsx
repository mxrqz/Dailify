import { useState } from "react";
import { MenuIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavItems } from "./index";

/** O acesso à navegação abaixo de `md`, onde a `Sidebar` é `hidden`. */
export function MobileNav(): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={copy.header.openNav}
        className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground md:hidden"
      >
        <MenuIcon className="size-5" />
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-64 gap-0 border-surface-line bg-surface-card p-3 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetTitle className="sr-only">{copy.profile.navLabel}</SheetTitle>
        <SheetDescription className="sr-only">{copy.header.openNav}</SheetDescription>

        {/* pt-8 deixa o X da folha sozinho na primeira linha; o clique em qualquer item fecha. */}
        <nav
          aria-label={copy.profile.navLabel}
          onClick={() => setOpen(false)}
          className="flex flex-1 flex-col gap-0.5 pt-8 pb-5"
        >
          <NavItems />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
