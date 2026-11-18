import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeftRightIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  CheckIcon,
  CreditCardIcon,
  ReceiptIcon,
} from "lucide-react";
import { FaCcAmex, FaCcVisa } from "react-icons/fa";
import { RiMastercardFill } from "react-icons/ri";
import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  QUOTA_KEYS,
  formatPrice,
  type Invoice,
  type PaymentDetails,
  type Quotas,
} from "@dailify/shared";

import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy as dashboardCopy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { PageHeader } from "@/components/kit/page-header";
import { copy } from "@/components/pricing/copy";
import { accountPage } from "@/components/settings-list";
import { ApplePayLogo, GooglePayLogo } from "@/components/logos";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { planMap } from "@/consts/conts";
import { billingPortal, getInvoices, getPaymentDetails } from "@/functions/api";
import { billingSections } from "@/functions/billing-sections";
import { fill } from "@/functions/functions";
import { quotaLabel } from "@/functions/quota-label";
import { useQuotas } from "@/hooks/useQuotas";
import { planOf, useSession } from "@/lib/auth";
import { openExternal } from "@/lib/open-external";
import { zoned } from "@/functions/zone";

const brandIcons: Record<string, JSX.Element> = {
  visa: <FaCcVisa className="size-4" />,
  mastercard: <RiMastercardFill className="size-4" />,
  amex: <FaCcAmex className="size-4" />,
};

const walletIcons: Record<string, JSX.Element> = {
  apple_pay: <ApplePayLogo className="h-4 fill-ink-secondary" />,
  google_pay: <GooglePayLogo className="h-4 fill-ink-secondary" />,
};

/** "Mastercard •••• 8421" (ou o logo da carteira), como a fatura mostra. */
function cardLabel(invoice: Invoice): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      {walletIcons[invoice.walletType ?? ""] ?? brandIcons[invoice.brandName ?? ""]}
      •••• {invoice.cardLast4}
    </span>
  );
}

/** A tela de Assinatura, sem sessão nem contexto: o container passa plano, quotas e cobrança. */
export function BillingView({
  currentPlan,
  quotas,
  paymentDetails,
  invoices,
  onManage,
}: {
  currentPlan: string;
  quotas: Quotas;
  paymentDetails: PaymentDetails | null | undefined;
  invoices: Invoice[] | undefined;
  onManage: () => void;
}): JSX.Element {
  const sections = billingSections(paymentDetails, invoices);
  // cópia antes de ordenar: `invoices` vem do contexto e `sort` é in-place
  const sorted = [...(invoices ?? [])].sort((a, b) => b.created - a.created);
  const renewMonth = format(addMonths(zoned(), 1), "MMMM", { locale: ptBR });

  return (
    <main className={accountPage}>
      <PageHeader title={copy.account.title} className="pt-2" />

      {/* O plano atual é um bloco, não uma lista: plano, preço e o uso do mês juntos. */}
      <section className="card mx-4 mt-5 rounded-lg p-5 md:mx-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-title-3 font-semibold">
            {fill(copy.account.currentPlan, { plan: planMap[currentPlan] ?? currentPlan })}
          </h2>
          {paymentDetails && (
            <span className="inline-flex h-6 items-center rounded-xs bg-fill px-2 text-xs font-medium">
              {copy.account.cycle[paymentDetails.recurring]}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-subhead text-ink-secondary tabular-nums">
          {paymentDetails
            ? fill(copy.account.price[paymentDetails.recurring], {
                amount: formatPrice(paymentDetails.amount, paymentDetails.currency),
              })
            : copy.account.freePrice}
        </p>

        {!quotas.loading && (
          <div className="mt-5 flex flex-col">
            {/* medidor antes, ilimitadas embaixo: o separador só cabe entre os dois */}
            {[...QUOTA_KEYS]
              .sort(
                (a, b) => Number(quotas.states[a].unlimited) - Number(quotas.states[b].unlimited),
              )
              .map((key) => {
                const state = quotas.states[key];
                const name = dashboardCopy.quota.names[key];
                if (state.unlimited) {
                  return (
                    <div
                      key={key}
                      className="flex justify-between border-separator text-subhead not-first:mt-4 not-first:border-t not-first:pt-3.5"
                    >
                      {name}
                      <span className="text-ink-secondary">{copy.account.unlimited[key]}</span>
                    </div>
                  );
                }
                return (
                  <div key={key} className="not-first:mt-4">
                    <div className="flex items-baseline justify-between text-subhead">
                      <span>{name}</span>
                      <span className="font-semibold tabular-nums">
                        {fill(copy.account.meter, { used: state.used, limit: state.limit })}
                      </span>
                    </div>
                    <Progress
                      value={state.ratio === null ? null : state.ratio * 100}
                      className="mt-2 h-2 rounded-full bg-fill *:rounded-full *:bg-ink"
                      aria-label={quotaLabel(state, name)}
                    />
                    <p className="mt-2 text-footnote text-ink-secondary">
                      {fill(copy.account.remaining, { n: state.remaining, month: renewMonth })}
                    </p>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {sections.subscription && paymentDetails && (
        <ListGroup title={copy.account.billingTitle} className="mx-4 mt-7 md:mx-0">
          <ListRow
            icon={<CalendarIcon />}
            label={copy.account.nextCharge}
            sublabel={format(zoned(paymentDetails.start * 1000), "d 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
            value={formatPrice(paymentDetails.amount, paymentDetails.currency)}
          />
          {sorted[0] && (
            <ListRow
              icon={<CreditCardIcon />}
              label={copy.account.paymentMethod}
              sublabel={cardLabel(sorted[0])}
            />
          )}
          <ListRow
            asChild
            icon={<ArrowLeftRightIcon />}
            label={copy.account.changePlan}
            value={copy.account.changePlanValue}
            accessory="chevron"
          >
            <Link to="/premium" />
          </ListRow>
        </ListGroup>
      )}

      <div className="mx-4 mt-7 md:mx-0">
        {sections.subscription ? (
          <Button size="lg" className="w-full" onClick={onManage}>
            {copy.account.manage}
            <ArrowUpRightIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button size="lg" className="w-full" asChild>
            <Link to="/premium">{copy.account.seePlans}</Link>
          </Button>
        )}
        <p className="mx-2 mt-2.5 text-center text-footnote text-balance text-ink-secondary">
          {sections.subscription ? copy.account.manageNote : copy.account.seePlansNote}
        </p>
      </div>

      <ListGroup title={copy.account.history} className="mx-4 mt-7 md:mx-0">
        {sections.invoices ? (
          sorted.map((invoice) => {
            const date = format(zoned(invoice.created * 1000), "d MMM yyyy", { locale: ptBR });
            return (
              <ListRow
                key={invoice.created}
                label={date}
                sublabel={cardLabel(invoice)}
                trailing={
                  <span className="flex items-center gap-3">
                    <span className="text-subhead font-medium tabular-nums">
                      {formatPrice(invoice.amount_paid, invoice.currency)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-footnote text-ink-secondary">
                      {invoice.status === "paid" && (
                        <CheckIcon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                      )}
                      {invoice.status && copy.account.status[invoice.status]}
                    </span>
                    {invoice.hosted_invoice_url && (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={fill(copy.account.viewInvoice, { date })}
                        className="-mr-2 grid size-11 place-items-center rounded-full text-ink-secondary transition-colors duration-fast hover:bg-fill hover:text-ink"
                      >
                        <ReceiptIcon className="size-5" />
                      </a>
                    )}
                  </span>
                }
              />
            );
          })
        ) : (
          <ListRow label={copy.account.noInvoices} />
        )}
      </ListGroup>
    </main>
  );
}

export default function BillingPage(): JSX.Element {
  const { data, refetch } = useSession();
  const userId = data?.user.id;
  const { invoices, paymentDetails, setInvoices, setPaymentDetails } = useDailify();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutStatus = searchParams.get("checkout");
  const quotas = useQuotas();

  // Volta do checkout do Stripe. O plano novo chega pelo webhook, então relê a sessão sem o cache
  // de cookie (5 min) em vez de confiar no `plan` que veio com ela.
  useEffect(() => {
    if (!checkoutStatus) return;
    if (checkoutStatus === "success") {
      toast.success(copy.page.checkoutSuccess);
      void refetch({ query: { disableCookieCache: true } });
    } else {
      toast.info(copy.page.checkoutCanceled);
    }
    setSearchParams({}, { replace: true });
  }, [checkoutStatus, setSearchParams, refetch]);

  // Só esta tela lê cobrança: buscar no boot de toda rota protegida custava duas idas ao Stripe
  // por abertura do app. O contexto guarda o último valor, então voltar aqui pinta na hora.
  useEffect(() => {
    if (!userId) return;
    // Each settles alone; a failed read keeps what the context already shows.
    void getPaymentDetails().then(({ paymentDetails }) => {
      if (paymentDetails !== undefined) setPaymentDetails(paymentDetails);
    });
    void getInvoices().then(({ invoices }) => {
      if (invoices) setInvoices(invoices);
    });
  }, [userId, setPaymentDetails, setInvoices]);

  const getBillingPortalUrl = async () => {
    const { url, error } = await billingPortal();
    if (url) await openExternal(url);
    else toast.error(copy.account.portalFailed, { description: error?.message });
  };

  return (
    <>
      <Helmet>
        <title>{copy.account.pageTitle}</title>
      </Helmet>
      <BillingView
        currentPlan={planOf(data?.user)}
        quotas={quotas}
        paymentDetails={paymentDetails}
        invoices={invoices}
        onManage={getBillingPortalUrl}
      />
    </>
  );
}
