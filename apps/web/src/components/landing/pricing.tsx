import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Role } from "@dailify/shared";
import { PLAN_PERMISSIONS, PLAN_ID } from "@dailify/shared";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PLAN_PRICING, type PlanPricing } from "@/consts/pricing";
import { copy } from "./copy";

/**
 * Pure bullet-list helper — derives pt-BR feature bullets straight from `PLAN_PERMISSIONS`
 * (`@dailify/shared`) so the pricing copy can never drift from the real plan limits. Rule:
 * `monthly === -1` ⇒ "Tarefas ilimitadas", else "{monthly} tarefas/mês"; `recurring === -1` ⇒
 * "Recorrência ilimitada", `recurring === 0` ⇒ omit a recurrence bullet; `voiceCreation` ⇒
 * "Criação por voz".
 */
export function planFeatures(role: Role): string[] {
  const { taskLimits, features } = PLAN_PERMISSIONS[role];
  const bullets: string[] = [
    taskLimits.monthly === -1 ? "Tarefas ilimitadas" : `${taskLimits.monthly} tarefas/mês`,
  ];
  if (taskLimits.recurring === -1) bullets.push("Recorrência ilimitada");
  if (features.voiceCreation) bullets.push("Criação por voz");
  return bullets;
}

const PLANS = [
  { role: PLAN_ID.free, copy: copy.pricing.plans.free, recommended: false, pricing: null },
  {
    role: PLAN_ID.pro,
    copy: copy.pricing.plans.pro,
    recommended: false,
    pricing: PLAN_PRICING.pro,
  },
  {
    role: PLAN_ID.proAi,
    copy: copy.pricing.plans.proAi,
    recommended: true,
    pricing: PLAN_PRICING["pro+ai"],
  },
] as const satisfies ReadonlyArray<{
  role: Role;
  copy: { name: string; description: string; cta: string };
  recommended: boolean;
  pricing: PlanPricing | null;
}>;

type Cycle = "monthly" | "yearly";

/**
 * Pricing (T9) — 3 honest plan cards (Free/Pro/Pro+AI) com preço real e toggle Mensal/Anual.
 * Os valores vêm de `PLAN_PRICING` (`@/consts/pricing`), a mesma fonte que `/premium` consome —
 * sem número digitado à mão em dois lugares. Free = "Grátis"; Pro/Pro+AI mostram
 * mensal/anual conforme o toggle, com a economia do anual em `text-success`. Crimson fica
 * reservado ao card recomendado (Pro+AI): `border-accent-primary` + badge + leve glow, seguindo
 * a regra de uma-cor-só. Cards limpos, sem cena bento — o contraste com a seção rica é proposital.
 */
export function Pricing(): JSX.Element {
  const reduce = useReducedMotion();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const { billing } = copy.pricing;

  return (
    <section className="px-gutter py-20 md:py-28">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-accent-primary">
          {copy.pricing.eyebrow}
        </p>
        <h2 className="text-balance text-2xl font-semibold tracking-[-0.02em] text-foreground md:text-3xl">
          {copy.pricing.title}
        </h2>

        <div className="mt-2 inline-flex items-center gap-1 rounded-full border bg-surface-card p-1">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-[0.04em] transition-colors",
                cycle === c
                  ? "bg-accent-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c === "monthly" ? billing.monthly : billing.yearly}
              {c === "yearly" && cycle !== "yearly" && (
                <span className="rounded-full bg-accent-subtle px-1.5 py-0.5 text-2xs normal-case text-accent-primary">
                  {billing.save}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <motion.div
            key={plan.role}
            initial={reduce ? undefined : { opacity: 0, y: 16 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn(
              "flex flex-col gap-6 rounded-xl border bg-surface-card p-6",
              plan.recommended &&
                "border-accent-primary shadow-[0_0_40px_-16px_var(--accent-glow)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                {plan.copy.name}
              </h3>
              {plan.recommended && (
                <span className="rounded-full bg-accent-subtle px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.04em] text-accent-primary">
                  {copy.pricing.recommendedBadge}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              {plan.pricing ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-semibold text-foreground">
                      {cycle === "monthly" ? plan.pricing.monthly : plan.pricing.yearly}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {cycle === "monthly" ? billing.perMonth : billing.perYear}
                    </span>
                  </div>
                  {/* invisible (não hidden) no mensal: reserva a linha pra altura não pular ao trocar o toggle */}
                  <span className={cn("text-xs text-success", cycle === "monthly" && "invisible")}>
                    {plan.pricing.yearlySavings}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-mono text-3xl font-semibold text-foreground">
                    {copy.pricing.freePrice}
                  </span>
                  <span className="text-xs text-muted-foreground">{copy.pricing.freeNote}</span>
                </>
              )}
            </div>

            <p className="text-sm text-content-secondary">{plan.copy.description}</p>

            <ul className="flex flex-col gap-2">
              {planFeatures(plan.role).map((feature) => (
                <li key={feature} className="font-mono text-xs text-muted-foreground">
                  {feature}
                </li>
              ))}
            </ul>

            <Button asChild className="mt-auto" variant={plan.recommended ? "default" : "outline"}>
              <Link to="/premium">{plan.copy.cta}</Link>
            </Button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
