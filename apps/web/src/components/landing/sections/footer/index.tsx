import { Link } from "react-router-dom";

import { Brand } from "@/components/brand";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

import { copy } from "./copy";

const THEMES = ["light", "dark", "system"] as const;
const link =
  "flex min-h-8 items-center text-sm text-ink-secondary transition-colors hover:text-ink";
const heading = "mb-1.5 text-sm font-semibold text-ink";

export function FooterV2() {
  const { theme, setTheme } = useTheme();

  return (
    <footer className="border-t border-separator">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 px-5 pt-8 pb-7 md:pt-10 md:pb-8">
        <div className="flex flex-col gap-7 md:flex-row md:justify-between">
          <div className="flex flex-col gap-2">
            <Brand to="/" className="self-start" />
            <p className="text-sm text-ink-secondary">{copy.tagline}</p>
          </div>
          <nav
            aria-label={copy.navLabel}
            className="grid grid-cols-2 gap-6 md:grid-cols-3 md:gap-14"
          >
            <div className="flex flex-col gap-0.5">
              <h2 className={heading}>{copy.product.title}</h2>
              <a href="#features" className={link}>
                {copy.product.features}
              </a>
              <a href="#pricing" className={link}>
                {copy.product.pricing}
              </a>
              <a href="#faq" className={link}>
                {copy.product.faq}
              </a>
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className={heading}>{copy.legal.title}</h2>
              <Link to="/termos" className={link}>
                {copy.legal.terms}
              </Link>
              <Link to="/privacidade" className={link}>
                {copy.legal.privacy}
              </Link>
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className={heading}>{copy.contact}</h2>
              <span className={cn(link, "select-all hover:text-ink-secondary")}>
                {copy.contactEmail}
              </span>
            </div>
          </nav>
        </div>
        <div className="flex flex-col-reverse items-start gap-4 text-sm text-ink-secondary md:flex-row md:items-center md:justify-between">
          <span>{copy.rights}</span>
          <div
            role="group"
            aria-label={copy.theme.label}
            className="flex gap-0.5 rounded-sm bg-fill p-0.5"
          >
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={theme === t}
                onClick={() => setTheme(t)}
                className={cn(
                  "min-h-8 cursor-pointer rounded-xs px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  theme === t ? "bg-surface-raised text-ink shadow-raised" : "hover:text-ink",
                )}
              >
                {copy.theme[t]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
