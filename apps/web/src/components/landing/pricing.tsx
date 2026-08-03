import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Role } from "@dailify/shared";
import { PLAN_PERMISSIONS, PLAN_ID } from "@dailify/shared";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  { role: PLAN_ID.free, copy: copy.pricing.plans.free, recommended: false, price: "Grátis" },
  { role: PLAN_ID.pro, copy: copy.pricing.plans.pro, recommended: false, price: null },
  { role: PLAN_ID.proAi, copy: copy.pricing.plans.proAi, recommended: true, price: null },
] as const;

/**
 * Pricing (T9) — 3 honest plan cards (Free/Pro/Pro+AI). No invented Pro/Pro+AI dollar amounts
 * here (real Stripe prices aren't wired into this section) — only Free gets a price ("Grátis");
 * the other two show name + description + bullets (from `planFeatures`) + CTA. Crimson is
 * reserved for the recommended card (Pro+AI): `border-accent-primary` + a mono
 * "RECOMENDADO" badge, per the design doc's one-color rule. Clean cards, no bento-style scene —
 * the contrast with the rich bento section is intentional.
 */
export function Pricing(): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <section className="px-[clamp(1rem,5vw,24rem)] py-20 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.04em] text-muted-foreground">
          {copy.pricing.tagline}
        </p>
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
              plan.recommended && "border-accent-primary",
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

            {plan.price && (
              <p className="font-mono text-3xl font-semibold text-foreground">{plan.price}</p>
            )}

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
