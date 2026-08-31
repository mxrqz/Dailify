import type { ReactNode } from "react";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PLAN_PERMISSIONS, formatPrice, yearlySavings } from "@dailify/shared";

import { PLAN_PRICING, type PlanRole } from "@/consts/pricing";
import { cn } from "@/lib/utils";
import { copy } from "./copy";

/**
 * Bullets derivados de `PLAN_PERMISSIONS` — a página de venda não pode prometer o que o servidor
 * não entrega. `recurring === 0` (Free) não gera bullet: é ausência de recurso, não recurso básico.
 */
export function planFeatures(role: PlanRole): string[] {
  const { taskLimits, features } = PLAN_PERMISSIONS[role];
  const bullets: string[] = [
    taskLimits.monthly === -1
      ? copy.features.unlimitedTasks
      : copy.features.monthlyTasks.replace("{n}", String(taskLimits.monthly)),
  ];
  if (taskLimits.recurring === -1) bullets.push(copy.features.unlimitedRecurrence);
  if (features.voiceCreation) bullets.push(copy.features.voiceCreation);
  return bullets;
}

export type Cycle = "monthly" | "yearly";

/**
 * Tabela de planos, compartilhada pela landing, `/premium` e `/billing`. O CTA muda por contexto
 * (link na landing, checkout nas outras), então vem de fora por `renderCta`.
 */
export function PlanCards({
  roles,
  recommended,
  renderCta,
  className,
}: {
  roles: readonly PlanRole[];
  recommended?: PlanRole;
  renderCta: (role: PlanRole, cycle: Cycle) => ReactNode;
  className?: string;
}): JSX.Element {
  const reduce = useReducedMotion();
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-surface-line bg-surface-page p-1">
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
              {c === "monthly" ? copy.billing.monthly : copy.billing.yearly}
              {c === "yearly" && cycle !== "yearly" && (
                <span className="text-2xs normal-case text-muted-foreground">
                  {copy.billing.save}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-6",
          roles.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
        )}
      >
        {roles.map((role) => {
          const pricing = role === "free" ? null : PLAN_PRICING[role];
          const isRecommended = role === recommended;

          return (
            <motion.div
              key={role}
              initial={reduce ? undefined : { opacity: 0, y: 16 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={cn(
                "flex flex-col gap-6 rounded-xl border border-surface-line bg-surface-page p-6",
                isRecommended && "border-accent-primary shadow-[0_0_40px_-16px_var(--accent-glow)]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                  {copy.plans[role].name}
                </h3>
                {isRecommended && (
                  <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
                    {copy.billing.recommendedBadge}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                {pricing ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-3xl font-semibold text-foreground">
                        {formatPrice(cycle === "monthly" ? pricing.monthly : pricing.yearly)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {cycle === "monthly" ? copy.billing.perMonth : copy.billing.perYear}
                      </span>
                    </div>
                    {/* invisible (não hidden) no mensal: reserva a linha pra altura não pular no toggle */}
                    <span
                      className={cn("text-xs text-success", cycle === "monthly" && "invisible")}
                    >
                      {copy.billing.savings.replace("{v}", formatPrice(yearlySavings(pricing)))}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-3xl font-semibold text-foreground">
                      {copy.billing.freePrice}
                    </span>
                    <span className="text-xs text-muted-foreground">{copy.billing.freeNote}</span>
                  </>
                )}
              </div>

              <p className="text-sm text-content-secondary">{copy.plans[role].description}</p>

              <ul className="flex flex-col gap-2">
                {planFeatures(role).map((feature) => (
                  <li key={feature} className="font-mono text-xs text-muted-foreground">
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-auto">{renderCta(role, cycle)}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
