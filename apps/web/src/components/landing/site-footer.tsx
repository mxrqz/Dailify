import { Link } from "react-router-dom";

import { copy } from "./copy";

/**
 * Site footer (T10) — "dissolves" into the page instead of cutting hard under the crimson CTA
 * band (design doc § "Footer que dissolve"). `bg-surface-page` matches the page background so
 * the shared, fixed `<Grain />` overlay (mounted once at the page root) bleeds through unchanged
 * — no grain re-instantiated here. `mask-t-from-85%` (Tailwind v4 built-in mask utility) fades
 * the footer's own top edge to transparent, mirroring the `.mask-b` gradient already used for the
 * hero's bottom fade in `global.css`, so the top blends into the section above rather than
 * hard-cutting; large rounded top corners (`rounded-t-panel`) read as the footer emerging as its
 * own panel. Real content starts well below the faded sliver (generous `pt-*`) so nothing legible
 * is masked.
 *
 * Only real links: Produto → in-page anchors `#features`/`#pricing` (Task 11 must add matching
 * `id`s to those sections); Legal → real routes `/privacidade` and `/termos`. No social links —
 * none are real yet, so none are shown (per the doc's "footer honesto" rule).
 */
export function SiteFooter(): JSX.Element {
  return (
    <footer className="relative mask-t-from-85% rounded-t-panel bg-surface-page px-[clamp(1rem,5vw,24rem)] pb-10 pt-24 md:pb-14 md:pt-32">
      <div className="grid gap-10 border-b pb-10 md:grid-cols-[1.5fr_1fr_1fr] md:gap-8">
        <div className="flex flex-col gap-3">
          <img
            src="/dailify_logo_2.png"
            alt={copy.footer.logoAlt}
            className="size-6 object-contain invert dark:invert-0"
          />
          <p className="max-w-xs text-sm text-content-secondary">{copy.footer.tagline}</p>
        </div>

        <nav aria-label={copy.footer.columns.product.title} className="flex flex-col gap-3">
          <h3 className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {copy.footer.columns.product.title}
          </h3>
          <ul className="flex flex-col gap-2">
            <li>
              <a href="#features" className="text-sm text-content-secondary hover:text-foreground">
                {copy.footer.columns.product.features}
              </a>
            </li>
            <li>
              <a href="#pricing" className="text-sm text-content-secondary hover:text-foreground">
                {copy.footer.columns.product.pricing}
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label={copy.footer.columns.legal.title} className="flex flex-col gap-3">
          <h3 className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {copy.footer.columns.legal.title}
          </h3>
          <ul className="flex flex-col gap-2">
            <li>
              <Link
                to="/privacidade"
                className="text-sm text-content-secondary hover:text-foreground"
              >
                {copy.footer.columns.legal.privacy}
              </Link>
            </li>
            <li>
              <Link to="/termos" className="text-sm text-content-secondary hover:text-foreground">
                {copy.footer.columns.legal.terms}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
          {copy.footer.status}
        </p>
        <p className="text-2xs text-muted-foreground">{copy.footer.copyright}</p>
      </div>
    </footer>
  );
}
