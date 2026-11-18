import { Link } from "react-router-dom";

import { Brand } from "@/components/brand";

import { copy } from "./copy";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b px-5 border-separator h-bar bg-material-bar backdrop-blur-xl backdrop-saturate-180">
      <nav className="mx-auto grid h-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center">
        <Brand to="/" className="col-start-2 justify-self-center" />
        <Link
          to="/login"
          className={`hit-target relative inline-flex h-7 items-center justify-self-end rounded-xs bg-brand px-3 text-sm font-semibold text-on-brand pointer-fine:active:bg-brand-pressed ${FOCUS}`}
        >
          {copy.signIn}
        </Link>
      </nav>
    </header>
  );
}
