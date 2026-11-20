import { useRef, useState } from "react";

import { Mew } from "@/components/mew/mew";
import { MewStatic } from "@/components/mew/mew-static";
import { ease } from "@/consts/motion";
import { cn } from "@/lib/utils";

import { copy } from "./copy";
import { useScene } from "./scene";

const t = copy.remind;
const JIGGLE = [
  { rotate: "0deg" },
  { rotate: "-2deg" },
  { rotate: "2deg" },
  { rotate: "-1deg" },
  { rotate: "0deg" },
];
/** A Mew dorme (zzz), a notificação desce e ela acorda com um pulinho. */
export function RemindArt() {
  const ref = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const [ring, setRing] = useState(false);

  const reduce = useScene(ref, async (wait) => {
    setRing(false);
    await wait(2200);
    setRing(true);
    note.current?.animate(JIGGLE, {
      duration: 500,
      delay: 500,
      easing: `cubic-bezier(${ease.standard.join()})`,
    });
    await wait(2800);
    setRing(false);
    await wait(800);
  });
  const awake = ring || reduce;

  return (
    <div ref={ref} className="relative grid size-full place-items-center">
      <div
        ref={note}
        className={cn(
          "absolute top-0 left-1/2 flex w-11/12 max-w-72 -translate-x-1/2 items-center gap-2.5 rounded-lg bg-surface-raised px-3 py-2.5 shadow-raised transition-[translate,opacity] duration-700 ease-spring",
          awake ? "translate-y-5.5" : "-translate-y-full opacity-0",
        )}
      >
        <span className="grid size-8.5 flex-none place-items-center rounded-sm bg-brand p-1.25">
          <MewStatic className="w-full" tone="onBrand" />
        </span>
        <span className="flex min-w-0 flex-col text-xs">
          <span className="flex justify-between gap-2">
            <b>{t.app}</b>
            <span className="text-ink-secondary">{t.when}</span>
          </span>
          <span>{t.body}</span>
        </span>
      </div>
      <Mew className="mt-14 w-24" mood={awake ? "alert" : "sleepy"} />
    </div>
  );
}
