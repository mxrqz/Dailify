import { Link } from "react-router-dom";

import { copy } from "./copy";

/**
 * Plinto preto do fechamento: uma caixa normal recuada de `--skirt`, com duas "saias" côncavas nos
 * cantos de baixo que alargam a base até as bordas da página. Antes a forma inteira era um
 * `clip-path` em px medido por ResizeObserver (`footer-frame.ts`) — mas ela não depende da largura,
 * então virou CSS puro e o conteúdo voltou a ser um filho normal, com padding normal. `--skirt` é a
 * única fonte do recuo: alimenta a margem, o tamanho das saias e o raio das máscaras.
 */
export function SiteFooter(): JSX.Element {
  return (
    <footer className="relative mx-(--skirt) rounded-t-panel bg-black p-5 [--skirt:1.75rem]">
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-full size-(--skirt) bg-black mask-[radial-gradient(circle_at_top_left,transparent_var(--skirt),black_calc(var(--skirt)+0.5px))]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-full size-(--skirt) bg-black mask-[radial-gradient(circle_at_top_right,transparent_var(--skirt),black_calc(var(--skirt)+0.5px))]"
      />

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
