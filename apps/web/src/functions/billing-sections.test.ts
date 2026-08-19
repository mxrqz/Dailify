import { describe, it, expect } from "vitest";
import type { InvoicesProps, PaymentDetailsProps } from "@/types/types";
import { billingSections } from "./billing-sections";

const subscription: PaymentDetailsProps = {
  amount: 990,
  currency: "brl",
  start: 1_755_000_000,
  recurring: "month",
};

const invoice: InvoicesProps = {
  amount_paid: 990,
  currency: "brl",
  status: "paid",
  created: 1_755_000_000,
  hosted_invoice_url: "https://invoice.stripe.com/x",
  recurring: "month",
};

describe("billingSections", () => {
  // O bug que motivou tudo: o server responde 400 pra quem não tem stripeCustomerId, o client
  // devolve null, e o gate antigo (`permissions && paymentDetails && invoices`) apagava a página
  // inteira — inclusive o consumo de tarefas, que não vem do Stripe.
  it("Free sem Stripe: esconde assinatura e faturas", () => {
    expect(billingSections(null, [])).toEqual({ subscription: false, invoices: false });
  });

  it("ainda carregando (undefined): esconde os dois", () => {
    expect(billingSections(undefined, undefined)).toEqual({
      subscription: false,
      invoices: false,
    });
  });

  it("assinante com histórico: mostra os dois", () => {
    expect(billingSections(subscription, [invoice])).toEqual({
      subscription: true,
      invoices: true,
    });
  });

  it("assinante recém-convertido: assinatura sim, faturas ainda não", () => {
    expect(billingSections(subscription, [])).toEqual({ subscription: true, invoices: false });
  });
});
