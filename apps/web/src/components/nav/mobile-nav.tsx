import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { useLocation } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
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
      <SheetTrigger asChild>
        <Button variant="ghost" size="bar" aria-label={copy.header.openNav} className="md:hidden">
          <MenuIcon aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left">
        <SheetTitle className="sr-only">{copy.profile.navLabel}</SheetTitle>
        <SheetDescription className="sr-only">{copy.header.openNav}</SheetDescription>

        {/* A link tap closes through the location sync above; the sheet's X shares the account
            row (pr-10). */}
        <nav
          aria-label={copy.profile.navLabel}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-5"
        >
          <NavItems />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
