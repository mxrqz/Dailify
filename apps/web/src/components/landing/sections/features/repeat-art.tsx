import { Repeat } from "lucide-react";
import { useRef, useState } from "react";

import { MewStatic } from "@/components/mew/mew-static";
import { cn } from "@/lib/utils";

import { copy } from "./copy";
import { useScene } from "./scene";

const t = copy.repeat;

/** Mês em grade; as segundas acendem uma por semana, com mola. */
export function RepeatArt() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const reduce = useScene(ref, async (wait) => {
    setOn(true);
    await wait(3800);
    setOn(false);
    await wait(500);
  });
  const lit = on || reduce;

  return (
    <div ref={ref} className="relative flex flex-col items-center gap-3.5">
      <div className="inline-flex h-7.5 items-center gap-1.5 rounded-full bg-surface-raised px-3 text-xs font-semibold shadow-raised">
        <Repeat className="size-3.5 text-meta-repeat" />
        {t.chip}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {t.weekdays.map((d, i) => (
          <span key={i} className="text-center text-2xs font-semibold text-ink-tertiary">
            {d}
          </span>
        ))}
        {Array.from({ length: 35 }, (_, i) => (
          <span key={i} className="relative size-5.5 rounded-xs bg-fill">
            {i % 7 === 0 && (
              <span
                className={cn(
                  "absolute inset-0 rounded-xs bg-brand",
                  // sem transição ao apagar: a volta pro mês vazio é instantânea, como na demo
                  lit
                    ? "scale-100 opacity-100 transition-[scale,opacity] duration-700 ease-spring"
                    : "scale-0 opacity-0",
                )}
                style={{ transitionDelay: lit && !reduce ? `${(i / 7) * 140 + 200}ms` : undefined }}
              />
            )}
          </span>
        ))}
      </div>
      <MewStatic className="absolute -right-14.5 bottom-0 w-13 -rotate-8" />
    </div>
  );
}
