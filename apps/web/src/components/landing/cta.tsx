import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { copy } from "./copy";

/**
 * Final CTA band (T10). The one deliberate full-bleed solid-color block on the landing page —
 * everywhere else crimson is an accent, here it's the whole section background, per the design
 * doc's "regra da cor única" ("the CTA crimson band is the intentional exception"). Button uses
 * `bg-background`/`text-foreground` so it reads as a light, contrasting chip against the crimson
 * fill in both themes.
 */
export function CtaBand(): JSX.Element {
  return (
    <section className="bg-accent-primary px-[clamp(1rem,5vw,24rem)] py-20 text-primary-foreground md:py-28">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-5xl">
          {copy.cta.title}
        </h2>
        <p className="max-w-lg text-lg text-primary-foreground/80">{copy.cta.subtitle}</p>
        <Button asChild size="lg" className="bg-background text-foreground hover:bg-background/90">
          <Link to="/login">{copy.cta.button}</Link>
        </Button>
      </div>
    </section>
  );
}
