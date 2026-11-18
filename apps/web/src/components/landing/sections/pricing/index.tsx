import { PLAN_PRICING, QUOTAS, formatPrice, yearlySavings } from "@dailify/shared";
import { CheckIcon } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Ears } from "@/components/landing/kit/ears";
import { fade } from "@/consts/motion";
import { cn } from "@/lib/utils";

import { copy } from "./copy";

type Cycle = "monthly" | "yearly";
type Plan = {
  key: "free" | "pro" | "max";
  to: string;
  pricing?: { monthly: number; yearly: number };
  featured?: boolean;
};

const PLANS: Plan[] = [
  { key: "free", to: "/signup" },
  { key: "pro", to: "/premium", pricing: PLAN_PRICING.pro, featured: true },
  { key: "max", to: "/premium", pricing: PLAN_PRICING.max },
];

const [noteBefore, noteAfter] = copy.note.split("{credits}");

/** Texto que troca com o ciclo: remonta pela `key` e entra com fade + subida curta. */
function Swap({ id, className, children }: { id: string; className?: string; children: string }) {
  return (
    <motion.span
      key={id}
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fade.transition}
    >
      {children}
    </motion.span>
  );
}

function PlanCard({ plan, cycle }: { plan: Plan; cycle: Cycle }) {
  const c = copy.plans[plan.key];
  const p = plan.pricing;
  const price = p ? formatPrice(p[cycle]) : copy.plans.free.price;
  const per = p ? copy.per[cycle] : copy.plans.free.per;
  const save =
    p && cycle === "yearly" ? copy.save.replace("{price}", formatPrice(yearlySavings(p))) : "";
  const credits = QUOTAS.ai.limits[plan.key].toLocaleString("pt-BR");

  return (
    <article
      className={cn(
        "relative flex flex-col gap-2.5 rounded-lg p-6",
        plan.featured ? "-order-1 mt-4 isolate md:order-none md:mt-0" : "bg-surface",
      )}
    >
      {plan.featured && (
        // contorno em camadas (anel, orelhas com traço, corpo), não filtro: feMorphology dilata
        // com kernel quadrado e engrossa diagonais/cantos para 2√2 px
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-lg outline-2 outline-brand"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 [&_path]:stroke-brand [&_path]:stroke-4 [&_path]:[paint-order:stroke]"
          >
            <Ears flick="right" />
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-lg bg-surface-raised"
          />
        </>
      )}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xl font-semibold tracking-tight">{c.name}</h3>
        {plan.featured && (
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-text">
            {copy.recommended}
          </span>
        )}
      </div>
      <p className="min-h-10 text-sm text-ink-secondary">{c.desc}</p>
      <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
        <Swap id={price} className="text-4xl font-bold tracking-tight">
          {price}
        </Swap>
        <Swap id={per} className="text-base text-ink-secondary">
          {per}
        </Swap>
      </div>
      <p className="min-h-4.5 text-sm font-semibold text-brand-text">
        {save && <Swap id={save}>{save}</Swap>}
      </p>
      <Link
        to={plan.to}
        className={cn(
          "mt-1.5 mb-1 inline-flex min-h-11 w-full items-center justify-center rounded-sm px-5 text-base font-semibold transition-[scale,background-color] duration-fast ease-out focus-ring focus-visible:ring-offset-2 active:scale-97",
          plan.featured
            ? "bg-brand text-on-brand hover:bg-brand-pressed pointer-fine:active:bg-brand-pressed"
            : "bg-fill text-ink hover:bg-fill-pressed pointer-fine:active:bg-fill-pressed",
        )}
      >
        {c.cta}
      </Link>
      <ul className="mb-auto flex flex-col gap-2.5">
        {c.features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-base">
            <CheckIcon aria-hidden="true" className="size-4 flex-none stroke-brand-text stroke-3" />
            <span>{f.replace("{n}", credits)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PricingV2() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <section className="flex flex-col gap-7 px-5 py-16 md:gap-9 md:py-28">
      <header className="flex flex-col items-center gap-2.5 text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-5xl">{copy.title}</h2>
        <p className="mb-1.5 text-base text-ink-secondary">{copy.subtitle}</p>
        <div
          role="group"
          aria-label={copy.billing.label}
          className="inline-grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-fill p-1"
        >
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              onClick={() => setCycle(c)}
              className={cn(
                "min-h-9 rounded-sm px-4 text-base focus-ring",
                cycle === c
                  ? "bg-surface-raised font-semibold text-ink shadow-raised"
                  : "font-medium text-ink-secondary",
              )}
            >
              {copy.billing[c]}
              {c === "yearly" && (
                <em className="ml-1 text-xs font-semibold text-brand-text not-italic">
                  {copy.billing.yearlyHint}
                </em>
              )}
            </button>
          ))}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:grid md:grid-cols-3 md:items-stretch md:pt-4">
        {PLANS.map((plan) => (
          <PlanCard key={plan.key} plan={plan} cycle={cycle} />
        ))}
      </div>
      <p className="mx-auto max-w-130 text-center text-sm text-ink-secondary">
        {noteBefore}
        <b className="font-semibold text-ink">{copy.noteCredits}</b>
        {noteAfter}
      </p>
    </section>
  );
}
