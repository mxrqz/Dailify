import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { copy } from "./copy";
import { OkArt } from "./ok-art";
import { RemindArt } from "./remind-art";
import { RepeatArt } from "./repeat-art";
import { TalkArt } from "./talk-art";

type CardProps = {
  text: { title: string; desc: string; ask: string };
  art: ReactNode;
  className?: string;
  artClassName?: string;
  textClassName?: string;
};

function Card({ text, art, className, artClassName, textClassName }: CardProps) {
  return (
    <article className={cn("flex flex-col overflow-hidden rounded-lg bg-surface", className)}>
      {/* arte é demonstração: o texto do card já diz tudo */}
      <div
        aria-hidden="true"
        className={cn("relative grid h-60 place-items-center overflow-hidden", artClassName)}
      >
        {art}
      </div>
      <div className={cn("flex flex-col items-start gap-2 px-5 pt-1 pb-5.5", textClassName)}>
        <h3 className="text-xl font-semibold tracking-tight">{text.title}</h3>
        <p className="text-sm text-ink-secondary">{text.desc}</p>
        <span className="mt-2 inline-flex h-9 items-center gap-2 rounded-full bg-ink px-3.5 text-sm font-semibold whitespace-nowrap text-canvas">
          {text.ask}
          <ArrowRight className="size-3.75" />
        </span>
      </div>
    </article>
  );
}

export function FeaturesV2() {
  return (
    <section className="px-5 py-16 md:pt-20 md:pb-28">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 md:gap-9">
        <h2 className="text-center text-3xl font-bold tracking-tight text-balance md:text-5xl">
          {copy.title}
        </h2>
        <div className="grid gap-3 md:grid-cols-11">
          <Card
            text={copy.talk}
            art={<TalkArt />}
            className="md:col-span-6 md:row-span-2"
            artClassName="h-95 md:h-auto md:min-h-85 md:flex-1"
          />
          <Card
            text={copy.repeat}
            art={<RepeatArt />}
            className="md:col-span-5"
            artClassName="md:h-55"
          />
          <Card
            text={copy.remind}
            art={<RemindArt />}
            className="md:col-span-5"
            artClassName="md:h-50"
          />
          <Card
            text={copy.ok}
            art={<OkArt />}
            className="md:col-span-full md:flex-row md:items-center"
            artClassName="h-95 md:h-85 md:w-1/2 md:flex-none"
            textClassName="md:py-6 md:pr-9 md:pl-2"
          />
        </div>
      </div>
    </section>
  );
}
