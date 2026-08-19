import { useAuth, useUser } from "@clerk/clerk-react";
import { format } from "date-fns";
import { CreditCard, Receipt } from "lucide-react";
import { FaCcAmex, FaCcVisa } from "react-icons/fa";
import { RiMastercardFill } from "react-icons/ri";
import { Link } from "react-router-dom";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import ApplePayLogo from "@/components/ui/applePayLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import GooglePayLogo from "@/components/ui/googlePayLogo";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PLAN_ID, planMap } from "@/consts/conts";
import { billingPortal } from "@/functions/api";
import { billingSections } from "@/functions/billing-sections";
import { useEntitlements } from "@/hooks/useEntitlements";
import { toText } from "@/lib/utils";

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

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <PageHeader title={copy.profile.billingPageTitle} />

      <Card className="rounded-2xl border-surface-line bg-surface-card">
        <CardHeader>
          <CardTitle>Plano e Assinatura</CardTitle>
          <CardDescription className="text-content-secondary">
            Gerencie seu plano atual e informações de pagamento.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Plano {plan}</h3>

                {sections.subscription && paymentDetails && (
                  <p className="text-sm text-content-secondary">
                    Próxima cobrança em{" "}
                    {format(new Date(paymentDetails.start * 1000), "dd/MM/yyyy")} •{" "}
                    {amountFormatted(paymentDetails.amount, paymentDetails.currency)} /{" "}
                    {paymentDetails.recurring}
                  </p>
                )}
              </div>

              {sections.subscription && (
                <Button variant="outline" onClick={getBillingPortalUrl}>
                  Gerenciar plano
                </Button>
              )}
            </div>

            <Separator className="my-4" />

            {!entitlements.loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Tarefas utilizadas</span>

                  <span className="font-medium">
                    {entitlements.tasksUsed} /{" "}
                    {entitlements.unlimited ? "ilimitado" : entitlements.monthlyLimit}
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
                    ? "Tarefas ilimitadas"
                    : `${entitlements.remaining} tarefas restantes neste ciclo`}
                </p>
              </div>
            )}
          </div>

          {paymentDetails === null && (
            <div className="rounded-lg border border-surface-line p-4">
              <p className="text-sm text-content-secondary">{copy.profile.billingNoSubscription}</p>
              <Button asChild variant="outline" className="mt-3">
                <Link to="/premium">{copy.profile.billingSeePlans}</Link>
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Histórico de pagamentos</h3>

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
                              {invoice.status === "paid" ? "Pago" : invoice.status}
                            </Badge>

                            <Link to={invoice.hosted_invoice_url ?? "#"}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Receipt className="h-4 w-4" />
                                <span className="sr-only">Ver fatura</span>
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
