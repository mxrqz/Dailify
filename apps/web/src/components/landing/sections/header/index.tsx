import { Menu } from "lucide-react";
import { Link } from "react-router-dom";

import { Brand } from "@/components/brand";

import { copy } from "./copy";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text";

export function SiteHeaderV2() {
  return (
    <header className="sticky top-0 z-40 border-b px-5 border-separator bg-material-bar pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-180">
      <nav className="mx-auto grid h-13 max-w-6xl grid-cols-[1fr_auto_1fr] items-center">
        {/* ponytail: ainda não abre nada; o menu da landing entra quando houver as âncoras */}
        <button
          type="button"
          aria-label={copy.menu}
          className={`-ml-2.75 grid size-11 place-items-center justify-self-start rounded-full text-ink ${FOCUS}`}
        >
          <Menu className="size-5.5" aria-hidden="true" />
        </button>
        <Brand to="/" className="justify-self-center" />
        <Link
          to="/login"
          className={`hit-target relative inline-flex h-7 items-center justify-self-end rounded-xs bg-brand px-3 text-sm font-semibold text-on-brand active:bg-brand-pressed ${FOCUS}`}
        >
          {copy.signIn}
        </Link>
      </nav>
    </header>
  );
}
