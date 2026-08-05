import { useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copy } from "./copy";
import { useCycle } from "./use-cycle";
import { HeroPanel } from "./hero-panel";

/**
 * Landing hero — título + subtítulo (com accent em rodízio) à esquerda, painel animado à direita.
 * Um único `useCycle` dá o índice ativo; subtítulo e painel leem o mesmo valor, então a palavra
 * crimson e a cena do painel nunca dessincronizam. `useReducedMotion()` congela no estado estático.
 */
export function Hero(): JSX.Element {
  const reduce = useReducedMotion();

  // Índice ativo compartilhado (mesmo trigger) entre as palavras `cycle` do subtítulo e o painel.
  const cycleCount = copy.hero.subtitle.filter((part) => part.cycle).length;
  const activeWord = useCycle(cycleCount, 7000, !reduce);

  return (
    <section className="flex w-full items-center px-gutter pt-[5rem] border-b h-[80dvh]">
      <div className="mr-5 w-[65ch] grid grid-rows-3 justify-center gap-6 md:gap-8 h-full pb-10">
        <div className="row-start-2">
          <h1 className="whitespace-nowrap text-5xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground ">
            {copy.hero.title}
          </h1>

          <p className="text-xl text-content-secondary">
            {(() => {
              let ci = -1;
              return copy.hero.subtitle.map((part, idx) => {
                if (!part.cycle) return <span key={idx}>{part.text}</span>;
                ci += 1;
                return (
                  <span
                    key={idx}
                    className={cn(
                      "transition-colors duration-700 ease-out-expo",
                      ci === activeWord ? "text-accent-primary" : "text-content-secondary",
                    )}
                  >
                    {part.text}
                  </span>
                );
              });
            })()}
          </p>
        </div>

        <div className="flex flex-col justify-end row-start-3 gap-5">
          <p className="pl-5 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {copy.hero.commandHint}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              className="rounded-full border-t border-t-surface-line bg-surface-card text-primary-foreground hover:bg-accent-hover"
            >
              {copy.hero.ctaPrimary}
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="rounded-full border-t border-t-surface-line bg-surface-card hover:bg-surface-hover"
            >
              {copy.hero.ctaSecondary}
            </Button>
          </div>
        </div>
      </div>

      <HeroPanel activeWord={activeWord} reduce={!!reduce} />
    </section>
  );
}
