import { Fragment } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { copy } from "./copy";

/**
 * Renderiza uma linha cujos trechos são indivisíveis: cada `chunk` vai num `whitespace-nowrap`, e o
 * único espaço quebrável fica ENTRE eles — então o texto fica em 1 linha quando cabe, e quando não
 * cabe quebra só nos limites dos trechos (nunca no meio de um). Pontos de quebra vêm de `copy` (T10).
 */
function BreakableLine({ chunks }: { chunks: readonly string[] }): JSX.Element {
  return (
    <>
      {chunks.map((chunk, i) => (
        <Fragment key={chunk}>
          {i > 0 ? " " : null}
          <span className="whitespace-nowrap">{chunk}</span>
        </Fragment>
      ))}
    </>
  );
}

/**
 * Final CTA (T10) — conteúdo do topo da região de fechamento escura. A tinta (`bg-surface-ink`) e o
 * grain animado NÃO vivem aqui: são do container compartilhado em `landingPage` que envolve a CTA e o
 * footer, pra o grain ser um campo único no fundo dos dois (espírito Mastra). Aqui fica só o conteúdo
 * transparente por cima: título, subtítulo e o botão crimson (variante default do `Button`) — um dos
 * seis usos de acento que a página permite (ação/estado ativo). Título e subtítulo
 * usam `BreakableLine` (sem `max-w` os prendendo) pra ficarem em 1 linha, quebrando só no ponto
 * definido em `copy.cta` quando a viewport é estreita. `px-6` só pro texto não colar na borda.
 */
export function CtaBand(): JSX.Element {
  return (
    <section className="section-y text-center">
      <div className="mx-auto flex flex-col items-center gap-6 px-6">
        <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] text-surface-ink-foreground sm:text-5xl">
          <BreakableLine chunks={copy.cta.title} />
        </h2>
        <p className="text-lg text-surface-ink-muted">
          <BreakableLine chunks={copy.cta.subtitle} />
        </p>
        <Button asChild size="lg">
          <Link to="/login">{copy.cta.button}</Link>
        </Button>
      </div>
    </section>
  );
}
