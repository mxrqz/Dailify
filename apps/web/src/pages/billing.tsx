import { useAuth, useUser } from "@clerk/clerk-react";
import { format } from "date-fns";
import { Receipt } from "lucide-react";
import { FaCcAmex, FaCcVisa } from "react-icons/fa";
import { RiMastercardFill } from "react-icons/ri";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QUOTA_KEYS } from "@dailify/shared";

import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { copy as pricingCopy } from "@/components/pricing/copy";
import { PlanCards, type Cycle } from "@/components/pricing/plan-cards";
import { SettingsGroup, SettingsRow, settingsPage } from "@/components/settings-list";
import ApplePayLogo from "@/components/ui/applePayLogo";
import { Button } from "@/components/ui/button";
import GooglePayLogo from "@/components/ui/googlePayLogo";
import { Progress } from "@/components/ui/progress";
import { PLAN_ID, planMap } from "@/consts/conts";
import type { PlanRole } from "@/consts/pricing";
import { billingPortal, checkout } from "@/functions/api";
import { billingSections } from "@/functions/billing-sections";
import { quotaLabel } from "@/functions/quota-label";
import { useQuotas } from "@/hooks/useQuotas";
import { toText } from "@/lib/utils";
import { zoned } from "@/functions/zone";

const PAID_ROLES: readonly PlanRole[] = [PLAN_ID.pro, PLAN_ID.proAi];

export default function BillingPage(): JSX.Element {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { invoices, paymentDetails } = useDailify();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutStatus = searchParams.get("checkout");

  // Volta do checkout do Stripe. O plano novo chega pelo webhook, então recarrega o user do Clerk
  // em vez de confiar no publicMetadata que veio com a sessão antiga.
  useEffect(() => {
    if (!checkoutStatus) return;
    if (checkoutStatus === "success") {
      toast.success(pricingCopy.page.checkoutSuccess);
      void user?.reload();
    } else {
      toast.info(pricingCopy.page.checkoutCanceled);
    }
    setSearchParams({}, { replace: true });
  }, [checkoutStatus, setSearchParams, user]);

  const sections = billingSections(paymentDetails, invoices);

  const currentPlan = toText(user?.publicMetadata.plan, PLAN_ID.free);
  const plan = planMap[currentPlan];
  const quotas = useQuotas();

  const brandIcons: Record<string, JSX.Element> = {
    visa: <FaCcVisa className="text-foreground size-4" />,
    mastercard: <RiMastercardFill className="text-foreground size-4" />,
    amex: <FaCcAmex className="text-foreground size-4" />,
  };

  const walletIcons: Record<string, JSX.Element> = {
    apple_pay: <ApplePayLogo className="fill-foreground h-4" />,
    google_pay: <GooglePayLogo className="fill-foreground h-4" />,
  };

  const amountFormatted = (amount: number, currency: string) => {
    return (amount / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency,
    });
  };

  const getBillingPortalUrl = async () => {
    const token = await getToken();
    if (!token) return;

    const { url } = await billingPortal(token);
    if (url) window.location.href = url;
  };

  const startCheckout = async (role: PlanRole, cycle: Cycle) => {
    const token = await getToken();
    if (!token) return;

    const { url } = await checkout(token, cycle === "yearly" ? `${role}-year` : role);
    if (url) window.location.href = url;
    else toast.error(pricingCopy.page.checkoutFailed);
  };

  return (
    <main className={settingsPage}>
      {/* sr-only: a sidebar e o title do Helmet já nomeiam a página na tela */}
      <h1 className="sr-only">{copy.profile.billingPageTitle}</h1>

      {/* O plano atual é um bloco, não uma lista: plano, próxima cobrança e o uso do mês juntos. */}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {copy.profile.billingTitle}
        </h2>
        <div className="flex flex-col gap-5 rounded-xl border border-surface-line bg-surface-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-lg font-medium">
                {copy.profile.billingCurrentPlan.replace("{plan}", plan)}
              </h3>
              {sections.subscription && paymentDetails && (
                <p className="text-sm text-content-secondary">
                  {copy.profile.billingNextCharge
                    .replace("{date}", format(zoned(paymentDetails.start * 1000), "dd/MM/yyyy"))
                    .replace(
                      "{amount}",
                      amountFormatted(paymentDetails.amount, paymentDetails.currency),
                    )
                    .replace("{cycle}", paymentDetails.recurring)}
                </p>
              )}
              {paymentDetails === null && (
                <p className="text-sm text-content-secondary">
                  {copy.profile.billingNoSubscription}
                </p>
              )}
            </div>

            {sections.subscription && (
              <Button variant="outline" size="sm" onClick={getBillingPortalUrl}>
                {copy.profile.billingManage}
              </Button>
            )}
          </div>

          {!quotas.loading && (
            <div className="flex flex-col gap-3">
              {QUOTA_KEYS.map((key) => {
                const state = quotas.states[key];
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-content-secondary">{copy.quota.names[key]}</span>
                      <span className="font-mono text-muted-foreground">
                        {state.used} / {state.unlimited ? copy.quota.unlimited : state.limit}
                      </span>
                    </div>
                    <Progress
                      value={state.ratio === null ? null : state.ratio * 100}
                      className="h-1"
                      aria-label={quotaLabel(state, copy.quota.names[key])}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5 px-1">
          <h2 className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {paymentDetails === null
              ? pricingCopy.billingSection.titleFree
              : pricingCopy.billingSection.titleSubscribed}
          </h2>
          <p className="text-xs text-muted-foreground">{pricingCopy.billingSection.description}</p>
        </div>

        <PlanCards
          roles={PAID_ROLES}
          recommended={PLAN_ID.proAi}
          currentPlan={currentPlan}
          renderCta={(role, cycle) =>
            role === currentPlan ? (
              <Button className="w-full" variant="outline" disabled>
                {pricingCopy.page.currentPlan}
              </Button>
            ) : (
              <Button
                className="w-full"
                variant={role === PLAN_ID.proAi ? "default" : "outline"}
                onClick={() => startCheckout(role, cycle)}
              >
                {pricingCopy.page.choosePlan}
              </Button>
            )
          }
        />
      </section>

      <SettingsGroup title={copy.profile.billingHistory}>
        {sections.invoices ? (
          // cópia antes de ordenar: `invoices` vem do contexto e `sort` é in-place
          [...(invoices ?? [])]
            .sort((a, b) => b.created - a.created)
            .map((invoice, index) => (
              <SettingsRow
                key={index}
                label={format(zoned(invoice.created * 1000), "dd/MM/yyyy")}
                hint={
                  <span className="flex items-center gap-1.5">
                    {walletIcons[toText(invoice?.walletType)] ??
                      brandIcons[toText(invoice?.brandName)]}
                    •••• {invoice?.cardLast4}
                  </span>
                }
              >
                <span className="font-mono text-xs text-content-secondary">
                  {amountFormatted(invoice.amount_paid, invoice.currency)}
                </span>
                <span className="rounded-md bg-surface-hover px-2 py-0.5 text-2xs text-content-secondary">
                  {invoice.status === "paid" ? copy.profile.billingPaid : invoice.status}
                </span>
                <Link
                  to={invoice.hosted_invoice_url ?? "#"}
                  aria-label={copy.profile.billingViewInvoice}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <Receipt className="size-4" />
                </Link>
              </SettingsRow>
            ))
        ) : (
          <SettingsRow label={copy.profile.billingNoInvoices} />
        )}
      </SettingsGroup>
    </main>
  );
}
