import { Link } from "react-router-dom";

import { copy } from "./copy";

export function SiteFooter(): JSX.Element {
  return (
    <footer className="plinth bg-black p-5">
      <div className="rounded-panel border border-surface-ink-line bg-surface-ink px-6 py-12 md:px-10 md:py-14">
        <div className="grid gap-10 border-b border-surface-ink-line pb-10 md:grid-cols-[1.5fr_1fr_1fr] md:gap-8">
          <div className="flex flex-col gap-3">
            <img
              src="/dailify_logo_2.png"
              alt={copy.footer.logoAlt}
              className="size-6 object-contain"
            />
            <p className="max-w-xs text-sm text-surface-ink-muted">{copy.footer.tagline}</p>
          </div>

          <nav aria-label={copy.footer.columns.product.title} className="flex flex-col gap-3">
            <h3 className="font-mono text-2xs uppercase tracking-[0.04em] text-surface-ink-muted">
              {copy.footer.columns.product.title}
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  href="#features"
                  className="text-sm text-surface-ink-muted transition-colors hover:text-surface-ink-foreground"
                >
                  {copy.footer.columns.product.features}
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="text-sm text-surface-ink-muted transition-colors hover:text-surface-ink-foreground"
                >
                  {copy.footer.columns.product.pricing}
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label={copy.footer.columns.legal.title} className="flex flex-col gap-3">
            <h3 className="font-mono text-2xs uppercase tracking-[0.04em] text-surface-ink-muted">
              {copy.footer.columns.legal.title}
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  to="/privacidade"
                  className="text-sm text-surface-ink-muted transition-colors hover:text-surface-ink-foreground"
                >
                  {copy.footer.columns.legal.privacy}
                </Link>
              </li>
              <li>
                <Link
                  to="/termos"
                  className="text-sm text-surface-ink-muted transition-colors hover:text-surface-ink-foreground"
                >
                  {copy.footer.columns.legal.terms}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-3 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.04em] text-surface-ink-muted">
            <span className="size-1.5 rounded-full bg-surface-ink-muted" aria-hidden="true" />
            {copy.footer.status}
          </p>
          <p className="text-2xs text-surface-ink-muted">{copy.footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
