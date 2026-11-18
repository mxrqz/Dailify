import { Link } from "react-router-dom";

import { copy } from "./copy";
import { HeroScene } from "./scene";

export function HeroV2() {
  return (
    <section aria-labelledby="hero-title" className="px-5 pt-8 pb-10 md:py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:grid md:grid-cols-[1fr_--spacing(95)] md:items-center md:gap-12">
        <div className="flex flex-col items-center gap-3.5 text-center md:items-start md:gap-5 md:text-left">
          <h1
            id="hero-title"
            className="text-5xl leading-none font-bold tracking-tight whitespace-pre-line md:text-7xl"
          >
            {copy.title}
          </h1>
          <p className="max-w-85 text-base leading-5.5 text-balance text-ink-secondary md:max-w-105 md:text-lg md:leading-7">
            {copy.sub}
          </p>
          <div className="mt-1.5 flex flex-col items-center gap-2.5 md:items-start">
            <Link
              to="/signup"
              className="inline-flex h-13 items-center rounded-md bg-brand px-6 text-lg font-semibold text-on-brand transition-[background-color,scale] duration-fast ease-out hover:bg-brand-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text active:scale-97"
            >
              {copy.cta}
            </Link>
            <small className="max-w-70 text-sm text-balance text-ink-secondary">
              {copy.ctaNote}
            </small>
          </div>
        </div>
        <HeroScene />
      </div>
    </section>
  );
}
