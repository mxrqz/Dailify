import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";

/** Campo ainda por preencher no template (`[e-mail de contato]`): marcado pra não passar batido. */
export function Placeholder({ children }: { children: ReactNode }): JSX.Element {
  return <span className="rounded-xs bg-fill px-1 text-ink">{children}</span>;
}

/**
 * Leitura de documento legal: barra de material com voltar, Large Title, data, sumário com âncoras
 * e as seções numeradas (o número vem da posição, como o id `#s1`… que o sumário aponta).
 */
export function LegalPage({
  pageTitle,
  bar,
  title,
  updated,
  intro,
  sections,
  contact,
  contactEmail,
}: {
  pageTitle: string;
  bar: string;
  title: string;
  updated: string;
  intro: ReactNode;
  sections: readonly { title: string; body: ReactNode }[];
  contact: string;
  contactEmail: ReactNode;
}): JSX.Element {
  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>

      <nav className="sticky top-0 z-20 grid h-bar grid-cols-[2.75rem_1fr_2.75rem] items-center bg-material-bar-solid px-2">
        <Link
          to="/"
          aria-label={copy.legal.back}
          className="grid size-11 place-items-center rounded-full text-ink pointer-fine:active:bg-fill [&_svg]:size-5.5"
        >
          <ChevronLeftIcon />
        </Link>
        <span className="text-center text-subhead font-semibold">{bar}</span>
      </nav>

      <main className="mx-auto w-full max-w-140 pb-10 text-body leading-6.5 text-ink">
        <header className="px-5 pt-1">
          <h1 className="text-title-1 text-balance">{title}</h1>
          <p className="mt-1.5 text-subhead font-medium text-ink-secondary">{updated}</p>
        </header>

        <p className="mx-5 mt-5 text-ink-secondary">{intro}</p>

        <nav aria-label={copy.legal.toc} className="card mx-4 mt-6 rounded-lg py-1">
          <h2 className="px-4 pt-3 pb-1 text-subhead font-medium text-ink-secondary">
            {copy.legal.toc}
          </h2>
          <ol>
            {sections.map((section, i) => (
              <li key={section.title} className="group">
                <a
                  href={`#s${i + 1}`}
                  className="grid min-h-11 grid-cols-[1.5rem_1fr_1rem] items-center gap-2 px-4 leading-5.5 pointer-fine:active:bg-fill"
                >
                  <b className="font-medium text-ink-secondary tabular-nums">{i + 1}</b>
                  <span className="self-stretch border-separator py-2.75 group-not-first:border-t">
                    {section.title}
                  </span>
                  <ChevronRightIcon aria-hidden="true" className="size-4 text-ink-tertiary" />
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((section, i) => (
          <section key={section.title} id={`s${i + 1}`} className="scroll-mt-bar px-5 pt-8">
            <h2 className="mb-2 text-title-3 font-semibold text-balance">
              {i + 1}. {section.title}
            </h2>
            <div className="text-ink-secondary [&_a]:font-medium [&_a]:text-brand-text [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5">
              {section.body}
            </div>
          </section>
        ))}

        <footer className="card mx-4 mt-10 flex flex-col gap-1 rounded-lg px-4 py-5">
          <strong className="text-body font-semibold">{copy.legal.questions}</strong>
          <p className="text-subhead text-ink-secondary">{contact}</p>
          <p className="mt-2">{contactEmail}</p>
        </footer>

        <Link
          to="/"
          className="mx-4 mt-4 flex h-11 items-center justify-center gap-1.5 rounded-sm bg-fill font-semibold text-ink transition-colors duration-fast hover:bg-fill-pressed"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-4.5" />
          {copy.legal.home}
        </Link>
      </main>
    </>
  );
}
