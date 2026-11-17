import { InfoIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/kit/page-header";
import { PlanCards, type Cycle } from "@/components/pricing/plan-cards";
import { Button } from "@/components/ui/button";
import { PLAN_ID } from "@/consts/conts";
import type { PlanRole } from "@/consts/pricing";
import { copy } from "@/components/pricing/copy";
import { checkout } from "@/functions/api";
import { planOf, useSession } from "@/lib/auth";
import { openExternal } from "@/lib/open-external";

const ROLES: readonly PlanRole[] = [PLAN_ID.free, PLAN_ID.pro, PLAN_ID.max];

/**
 * A tela de Planos, sem sessão: `currentPlan` indefinido = deslogado (ninguém marcado, o Free vira
 * "Começar grátis"). O recomendado é o Max (`PLAN_ID.max`), o das orelhinhas.
 */
export function PlansView({
  currentPlan,
  onSelect,
}: {
  currentPlan?: string;
  onSelect: (role: PlanRole, cycle: Cycle) => void;
}): JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col pb-10">
      <PageHeader title={copy.page.title} subtitle={copy.page.subtitle} className="pt-2" />

      <PlanCards
        className="mt-6 px-4 md:px-0"
        roles={ROLES}
        recommended={PLAN_ID.max}
        currentPlan={currentPlan}
        renderCta={(role, cycle) => {
          const name = copy.plans[role].name;
          if (role === currentPlan) {
            return (
              <Button size="lg" variant="secondary" className="w-full" disabled>
                {copy.page.currentPlan}
              </Button>
            );
          }
          // Free não tem checkout: deslogado cria a conta; assinante desce de plano pelo portal.
          if (role === PLAN_ID.free) {
            return currentPlan ? null : (
              <Button size="lg" variant="secondary" className="w-full" asChild>
                <Link to="/signup">{copy.page.startFree}</Link>
              </Button>
            );
          }
          return (
            <Button
              size="lg"
              variant={role === PLAN_ID.max ? "default" : "secondary"}
              className="w-full"
              onClick={() => onSelect(role, cycle)}
            >
              {copy.page.choosePlan.replace("{plan}", name)}
            </Button>
          );
        }}
      />

      <aside className="card mx-4 mt-6 flex gap-3 rounded-lg p-4 md:mx-0">
        <InfoIcon aria-hidden="true" className="mt-0.5 size-5 flex-none text-ink-secondary" />
        <div>
          <h2 className="text-body font-semibold">{copy.page.creditsTitle}</h2>
          <p className="mt-1 text-subhead text-ink-secondary">{copy.page.creditsBody}</p>
        </div>
      </aside>

      <p className="mx-8 mt-5 text-center text-footnote text-balance text-ink-secondary">
        {copy.page.fine}
      </p>

      {!currentPlan && (
        <p className="mt-4 text-center text-subhead text-ink-secondary">
          {copy.page.haveAccount}{" "}
          <Link to="/login" className="font-semibold text-ink hover:underline">
            {copy.page.signIn}
          </Link>
        </p>
      )}
    </main>
  );
}

/** Escolher plano — pública, fica fora do `ProtectedRoute` de propósito (é a página de venda). */
export default function PremiumPage(): JSX.Element {
  const user = useSession().data?.user;

  const handleSelectPlan = async (role: PlanRole, cycle: Cycle) => {
    if (!user) {
      toast.error(copy.page.signInFirst);
      return;
    }

    const { url } = await checkout(cycle === "yearly" ? `${role}-year` : role);
    if (url) await openExternal(url);
    else toast.error(copy.page.checkoutFailed);
  };

  return <PlansView currentPlan={user ? planOf(user) : undefined} onSelect={handleSelectPlan} />;
}
