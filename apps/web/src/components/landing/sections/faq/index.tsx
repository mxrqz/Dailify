import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

import { copy } from "./copy";

export function FaqV2() {
  const [open, setOpen] = useState<number | null>(0);
  const id = useId();

  return (
    <section id="faq" className="scroll-mt-bar px-5 py-16 md:py-28">
      <div className="mx-auto flex max-w-180 flex-col gap-6 md:gap-8">
        <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">{copy.title}</h2>
        <div className="divide-y divide-separator overflow-hidden rounded-lg bg-surface">
          {copy.items.map(({ q, a }, i) => {
            const isOpen = open === i;
            return (
              <div key={q}>
                <h3>
                  <button
                    type="button"
                    id={`${id}-q${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`${id}-a${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-md px-4.5 py-3.5 text-left text-lg leading-snug font-semibold tracking-tight text-ink focus-ring focus-visible:ring-inset"
                  >
                    <span>{q}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "size-4.5 shrink-0 text-ink-secondary transition-[rotate] duration-300 ease-out motion-reduce:transition-none",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </h3>
                {/* grid-rows 0fr→1fr anima a altura real sem medir no JS */}
                <div
                  id={`${id}-a${i}`}
                  role="region"
                  aria-labelledby={`${id}-q${i}`}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="min-h-0 overflow-hidden" aria-hidden={!isOpen}>
                    <p
                      className={cn(
                        "px-4.5 pb-4 text-base leading-snug text-ink-secondary transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none",
                        isOpen ? "translate-y-0 opacity-100 delay-60" : "-translate-y-1 opacity-0",
                      )}
                    >
                      {a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
