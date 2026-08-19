import { Link } from "react-router-dom";

import { PlanCards } from "@/components/pricing/plan-cards";
import { Button } from "@/components/ui/button";
import { PLAN_ID } from "@/consts/conts";
import type { PlanRole } from "@/consts/pricing";
import { copy } from "./copy";

const ROLES: readonly PlanRole[] = [PLAN_ID.free, PLAN_ID.pro, PLAN_ID.proAi];

const CTA: Record<PlanRole, string> = {
  free: copy.pricing.plans.free.cta,
  pro: copy.pricing.plans.pro.cta,
  "pro+ai": copy.pricing.plans.proAi.cta,
};

/**
 * Pricing (T9) — os cards vêm do `PlanCards` compartilhado com `/premium` e `/billing`, então preço,
 * features e visual não divergem entre a página de venda e a de cobrança. Aqui o CTA só navega;
 * quem dispara o checkout é o `/premium`.
 */
export function Pricing(): JSX.Element {
  return (
    <section className="border-y border-surface-line bg-surface-slab px-gutter section-y">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {copy.pricing.eyebrow}
        </p>
        <h2 className="text-balance text-2xl font-semibold tracking-[-0.02em] text-foreground md:text-3xl">
          {copy.pricing.title}
        </h2>
      </div>

      <PlanCards
        roles={ROLES}
        recommended={PLAN_ID.proAi}
        className="mt-8"
        renderCta={(role) => (
          <Button
            asChild
            className="w-full"
            variant={role === PLAN_ID.proAi ? "default" : "outline"}
          >
            <Link to="/premium">{CTA[role]}</Link>
          </Button>
        )}
      />
    </section>
  );
}
