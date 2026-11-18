import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Bubble } from "@/components/landing/kit/bubble";
import { Mew } from "@/components/mew/mew";
import { cn } from "@/lib/utils";

import { copy } from "./copy";

export function Cta() {
  const [pet, setPet] = useState(false);
  const [hold, setHold] = useState(false);

  // soltar fora da gatinha também encerra o "segurando"
  useEffect(() => {
    if (!hold) return;
    const up = () => setHold(false);
    addEventListener("pointerup", up);
    return () => removeEventListener("pointerup", up);
  }, [hold]);

  return (
    <section className="flex flex-col items-center gap-3.5 px-5 py-16 text-center md:py-28">
      <Bubble flick="right" tail className="text-lg leading-snug font-semibold">
        {copy.bubble}
      </Bubble>
      <div
        className={cn(
          "mt-1.5 mb-2.5 w-30 touch-none transition-[scale,rotate] duration-420 ease-spring motion-reduce:transition-none md:w-37.5",
          hold ? "scale-x-95 scale-y-102 -rotate-5 cursor-grabbing" : "cursor-grab",
          pet && !hold && "scale-104 -rotate-3",
        )}
        onPointerEnter={() => setPet(true)}
        onPointerLeave={() => {
          setPet(false);
          setHold(false);
        }}
        onPointerDown={() => setHold(true)}
      >
        <Mew happy={pet} className="block h-auto w-full" />
      </div>
      <h2 className="text-4xl font-bold tracking-tight md:text-5xl">{copy.title}</h2>
      <p className="max-w-85 text-base text-balance text-ink-secondary">{copy.body}</p>
      <div className="mt-2.5 flex flex-col items-center gap-2">
        <Link
          to="/signup"
          className="inline-flex h-13 items-center rounded-md bg-brand px-6 text-lg font-semibold text-on-brand transition-[scale] focus-ring hover:bg-brand-pressed focus-visible:ring-offset-2 active:scale-97 pointer-fine:active:bg-brand-pressed"
        >
          {copy.button}
        </Link>
        <small className="text-sm text-ink-secondary">{copy.note}</small>
      </div>
    </section>
  );
}
