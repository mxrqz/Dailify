import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PlanCards, type Cycle } from "@/components/pricing/plan-cards";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { PLAN_ID } from "@/consts/conts";
import type { PlanRole } from "@/consts/pricing";
import { copy } from "@/components/pricing/copy";
import { checkout } from "@/functions/api";

const PAID_ROLES: readonly PlanRole[] = [PLAN_ID.pro, PLAN_ID.proAi];

/**
 * Escolher plano — pública, fica fora do `ProtectedRoute` de propósito (é a página de venda). Os
 * cards são o `PlanCards` compartilhado com a landing e o `/billing`.
 */
export default function PremiumPage(): JSX.Element {
  const { getToken } = useAuth();

  const handleSelectPlan = async (role: PlanRole, cycle: Cycle) => {
    const token = await getToken();
    if (!token) {
      toast.error(copy.page.signInFirst);
      return;
    }

    const { url } = await checkout(token, cycle === "yearly" ? `${role}-year` : role);
    if (url) window.location.href = url;
    else toast.error(copy.page.checkoutFailed);
  };

  return (
    <main className="flex w-full flex-col gap-16 py-12">
      <header className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {copy.page.eyebrow}
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.02em] text-foreground md:text-4xl">
          {copy.page.title}
        </h1>
        <p className="text-balance text-content-secondary">{copy.page.subtitle}</p>
      </header>

      <PlanCards
        roles={PAID_ROLES}
        recommended={PLAN_ID.proAi}
        renderCta={(role, cycle) => (
          <Button
            className="w-full"
            variant={role === PLAN_ID.proAi ? "default" : "outline"}
            onClick={() => handleSelectPlan(role, cycle)}
          >
            {copy.page.choosePlan}
          </Button>
        )}
      />

      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h2 className="text-center text-xl font-semibold tracking-[-0.01em] text-foreground">
          {copy.page.faqTitle}
        </h2>

        <Accordion type="single" collapsible className="w-full">
          {copy.faqs.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-content-secondary">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-center text-sm text-muted-foreground">
          {copy.page.haveAccount}{" "}
          <Link to="/login" className="text-accent-primary hover:underline">
            {copy.page.signIn}
          </Link>
        </p>
      </section>
    </main>
  );
}
