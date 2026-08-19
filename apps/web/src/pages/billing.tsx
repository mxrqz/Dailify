import { useAuth, useUser } from "@clerk/clerk-react";
import { format } from "date-fns";
import { CreditCard, Receipt } from "lucide-react";
import { FaCcAmex, FaCcVisa } from "react-icons/fa";
import { RiMastercardFill } from "react-icons/ri";
import { Link } from "react-router-dom";

import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { copy as pricingCopy } from "@/components/pricing/copy";
import { PlanCards, type Cycle } from "@/components/pricing/plan-cards";
import { Badge } from "@/components/ui/badge";
import ApplePayLogo from "@/components/ui/applePayLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GooglePayLogo from "@/components/ui/googlePayLogo";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PLAN_ID, planMap } from "@/consts/conts";
import type { PlanRole } from "@/consts/pricing";
import { billingPortal, checkout } from "@/functions/api";
import { billingSections } from "@/functions/billing-sections";
import { useEntitlements } from "@/hooks/useEntitlements";
import { toText } from "@/lib/utils";

const PAID_ROLES: readonly PlanRole[] = [PLAN_ID.pro, PLAN_ID.proAi];

export default function BillingPage(): JSX.Element {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { invoices, paymentDetails } = useDailify();

  const sections = billingSections(paymentDetails, invoices);

  const plan = planMap[toText(user?.publicMetadata.plan, PLAN_ID.free)];
  const entitlements = useEntitlements();

  const brandIcons: Record<string, JSX.Element> = {
    visa: <FaCcVisa className="text-foreground size-5" />,
    mastercard: <RiMastercardFill className="text-foreground size-5" />,
    amex: <FaCcAmex className="text-foreground size-5" />,
  };

  const walletIcons: Record<string, JSX.Element> = {
    apple_pay: <ApplePayLogo className="fill-foreground h-5" />,
    google_pay: <GooglePayLogo className="fill-foreground h-5" />,
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
    <main className="flex w-full flex-col gap-6 py-6">
      {/* sr-only: a sidebar e o title do Helmet já nomeiam a página na tela */}
      <h1 className="sr-only">{copy.profile.billingPageTitle}</h1>

      <Card className="rounded-2xl border-surface-line bg-surface-card">
        <CardHeader>
          <CardTitle>{copy.profile.billingTitle}</CardTitle>
          <CardDescription className="text-content-secondary">
            {copy.profile.billingDescription}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {copy.profile.billingCurrentPlan.replace("{plan}", plan)}
                </h3>

                {sections.subscription && paymentDetails && (
                  <p className="text-sm text-content-secondary">
                    {copy.profile.billingNextCharge
                      .replace(
                        "{date}",
                        format(new Date(paymentDetails.start * 1000), "dd/MM/yyyy"),
                      )
                      .replace(
                        "{amount}",
                        amountFormatted(paymentDetails.amount, paymentDetails.currency),
                      )
                      .replace("{cycle}", paymentDetails.recurring)}
                  </p>
                )}
              </div>

              {sections.subscription && (
                <Button variant="outline" onClick={getBillingPortalUrl}>
                  {copy.profile.billingManage}
                </Button>
              )}
            </div>

            <Separator className="my-4" />

            {!entitlements.loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{copy.profile.billingTasksUsed}</span>

                  <span className="font-medium">
                    {entitlements.tasksUsed} /{" "}
                    {entitlements.unlimited
                      ? copy.profile.billingUnlimited
                      : entitlements.monthlyLimit}
                  </span>
                </div>

                <Progress
                  value={
                    entitlements.unlimited || entitlements.monthlyLimit <= 0
                      ? 0
                      : (entitlements.tasksUsed / entitlements.monthlyLimit) * 100
                  }
                  className="h-2"
                />

                <p className="text-xs text-muted-foreground">
                  {entitlements.unlimited
                    ? copy.profile.billingUnlimitedTasks
                    : copy.profile.billingRemaining.replace("{n}", String(entitlements.remaining))}
                </p>
              </div>
            )}
          </div>

          {paymentDetails === null && (
            <p className="text-sm text-content-secondary">{copy.profile.billingNoSubscription}</p>
          )}

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">
                {paymentDetails === null
                  ? pricingCopy.billingSection.titleFree
                  : pricingCopy.billingSection.titleSubscribed}
              </h3>
              <p className="text-sm text-content-secondary">
                {pricingCopy.billingSection.description}
              </p>
            </div>

            <PlanCards
              roles={PAID_ROLES}
              recommended={PLAN_ID.proAi}
              renderCta={(role, cycle) => (
                <Button
                  className="w-full"
                  variant={role === PLAN_ID.proAi ? "default" : "outline"}
                  onClick={() => startCheckout(role, cycle)}
                >
                  {pricingCopy.page.choosePlan}
                </Button>
              )}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{copy.profile.billingHistory}</h3>

            {sections.invoices ? (
              <div className="space-y-4">
                {invoices
                  ?.sort((a, b) => {
                    return b.created - a.created;
                  })
                  .map((invoice, index) => (
                    <div className="flex flex-col gap-1" key={index}>
                      <p className="text-sm text-content-secondary">
                        {format(new Date(invoice.created * 1000), "dd/MM/yyyy")} -{" "}
                        {amountFormatted(invoice.amount_paid, invoice.currency)}
                      </p>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle relative">
                            <CreditCard className="h-5 w-5 text-foreground" />
                          </div>

                          <div className="flex justify-center flex-col">
                            <div className="w-fit">
                              {walletIcons[toText(invoice?.walletType)] ?? null}
                            </div>

                            <div className="flex gap-2">
                              {brandIcons[toText(invoice?.brandName)]}

                              <p className="font-medium">••••</p>

                              <p className="font-medium">{invoice?.cardLast4}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {invoice.status === "paid"
                                ? copy.profile.billingPaid
                                : invoice.status}
                            </Badge>

                            <Link to={invoice.hosted_invoice_url ?? "#"}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Receipt className="h-4 w-4" />
                                <span className="sr-only">{copy.profile.billingViewInvoice}</span>
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-content-secondary">{copy.profile.billingNoInvoices}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
