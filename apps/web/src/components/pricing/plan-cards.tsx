import { duration, ease } from "@/consts/motion";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { CheckIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { limitsFor, QUOTA_KEYS, formatPrice, yearlySavings } from "@dailify/shared";

import { SegmentedControl } from "@/components/kit/segmented-control";
import { PLAN_PRICING, type PlanRole } from "@/consts/pricing";
import { cn } from "@/lib/utils";
import { copy } from "./copy";

/**
 * Bullets derivados do registro de quotas — a página de venda não pode prometer o que o servidor
 * não entrega, nem calar o que entrega. Limite `0` não vira bullet: é ausência de recurso.
 */
export function planFeatures(role: PlanRole): string[] {
  const limits = limitsFor(role);
  return QUOTA_KEYS.filter((key) => limits[key] !== 0).map((key) =>
    limits[key] < 0
      ? copy.features.unlimited[key]
      : copy.features.finite[key].replace("{n}", limits[key].toLocaleString("pt-BR")),
  );
}

export type Cycle = "monthly" | "yearly";

/**
 * Tabela de planos, compartilhada pela landing, `/premium` e `/billing`. O CTA muda por contexto
 * (link na landing, checkout nas outras), então vem de fora por `renderCta`.
 */
export function PlanCards({
  roles,
  recommended,
  currentPlan,
  renderCta,
  className,
}: {
  roles: readonly PlanRole[];
  recommended?: PlanRole;
  /**
   * O plano que o usuário assina, pra marcar o card. `string` e não `PlanRole` de propósito: o valor
   * vem do `publicMetadata` do Clerk, que é texto livre — quem escreve lá é o webhook do Stripe, e
   * um id desconhecido tem que simplesmente não casar com card nenhum, não virar erro de tipo aqui.
   */
  currentPlan?: string;
  renderCta: (role: PlanRole, cycle: Cycle) => ReactNode;
  className?: string;
}): JSX.Element {
  const reduce = useReducedMotion();
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <SegmentedControl
        aria-label={copy.page.cycleLabel}
        value={cycle}
        onValueChange={setCycle}
        options={[
          { value: "monthly", label: copy.billing.monthly },
          {
            value: "yearly",
            label: (
              <>
                {copy.billing.yearly}
                {cycle !== "yearly" && (
                  <span className="ml-1.5 text-xs font-medium text-ink-secondary">
                    {copy.billing.save}
                  </span>
                )}
              </>
            ),
          },
        ]}
        className="mx-auto w-full max-w-sm"
      />

      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          roles.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
        )}
      >
        {roles.map((role) => {
          const pricing = role === "free" ? null : PLAN_PRICING[role];
          const isCurrent = role === currentPlan;
          // Não se recomenda a alguém o que ela já assina: ser o plano atual ganha do selo de
          // recomendado, senão o card do Max anunciaria "Recomendado" pra quem já o tem.
          const isRecommended = role === recommended && !isCurrent;

          return (
            <motion.section
              key={role}
              aria-label={copy.plans[role].name}
              initial={reduce ? undefined : { opacity: 0, y: 16 }}
              whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: duration.slow, ease: ease.out }}
              className={cn(
                "card relative flex flex-col rounded-lg p-5",
                // As orelhas sobem 24px acima do card: a margem abre o espaço delas na coluna.
                isRecommended && "max-md:mt-6",
              )}
            >
              {isRecommended && <Ears />}
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-title-3 font-semibold">{copy.plans[role].name}</h3>
                {isCurrent && (
                  <span className="inline-flex h-6 items-center gap-1 rounded-xs bg-fill px-2 text-xs font-medium">
                    <CheckIcon aria-hidden="true" className="size-3" strokeWidth={3} />
                    {copy.billing.currentBadge}
                  </span>
                )}
                {isRecommended && (
                  <span className="inline-flex h-6 items-center rounded-xs bg-ink px-2 text-xs font-medium text-canvas">
                    {copy.billing.recommendedBadge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-subhead text-ink-secondary">{copy.plans[role].description}</p>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-1 tabular-nums">
                <span className="text-title-1">
                  {pricing
                    ? formatPrice(cycle === "monthly" ? pricing.monthly : pricing.yearly)
                    : copy.billing.freePrice}
                </span>
                <span className="text-subhead text-ink-secondary">
                  {pricing
                    ? cycle === "monthly"
                      ? copy.billing.perMonth
                      : copy.billing.perYear
                    : copy.billing.freeNote}
                </span>
                {pricing && cycle === "yearly" && (
                  <span className="basis-full text-footnote text-success">
                    {copy.billing.savings.replace("{v}", formatPrice(yearlySavings(pricing)))}
                  </span>
                )}
              </div>

              <ul className="mt-4 mb-5 flex flex-col gap-2.5">
                {planFeatures(role).map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-subhead">
                    <CheckIcon
                      aria-hidden="true"
                      className="mt-px size-4.5 flex-none text-ink-secondary"
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-auto">{renderCta(role, cycle)}</div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}

const EAR = "M0 30 C6 20 12 10 17 4 Q21 0 24 4 C28 12 32 22 38 30";

/**
 * As orelhinhas de gato do plano recomendado: a cor do card, que cobre o contorno dele na base, e
 * o contorno da orelha cortado na linha do topo do card (os 6px de baixo ficam dentro dele).
 */
function Ears(): JSX.Element {
  const clip = useId();
  return (
    <>
      {["left-7", "right-7 -scale-x-100"].map((side, i) => (
        <svg
          key={side}
          aria-hidden="true"
          viewBox="0 0 38 30"
          className={cn("absolute -top-6 h-7.5 w-9.5 overflow-visible", side)}
        >
          <clipPath id={`${clip}${i}`}>
            <rect x="-1" y="-1" width="40" height="25.5" />
          </clipPath>
          <path d={`${EAR}Z`} className="fill-surface" />
          <path d={EAR} clipPath={`url(#${clip}${i})`} className="fill-none stroke-card-edge" />
        </svg>
      ))}
    </>
  );
}
