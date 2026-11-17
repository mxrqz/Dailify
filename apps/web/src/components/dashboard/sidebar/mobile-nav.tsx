import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { useLocation } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavItems } from "./index";

/** O acesso à navegação abaixo de `md`, onde a `Sidebar` é `hidden`: a gaveta de vidro da esquerda. */
export function MobileNav(): JSX.Element {
  const [open, setOpen] = useState(false);
  // Any navigation (a link, the device back) closes the drawer; state adjusted during render.
  const location = useLocation();
  const [seen, setSeen] = useState(location);
  if (seen !== location) {
    setSeen(location);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={copy.header.openNav}
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink transition-colors duration-fast hover:bg-fill md:hidden [&_svg]:size-5.5"
      >
        <MenuIcon aria-hidden="true" />
      </SheetTrigger>

      <SheetContent side="left">
        <SheetTitle className="sr-only">{copy.profile.navLabel}</SheetTitle>
        <SheetDescription className="sr-only">{copy.header.openNav}</SheetDescription>

        {/* O clique em qualquer item fecha; o X da folha divide a linha com a conta (pr-10). */}
        <nav
          aria-label={copy.profile.navLabel}
          onClick={() => setOpen(false)}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-5"
        >
          <NavItems />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
