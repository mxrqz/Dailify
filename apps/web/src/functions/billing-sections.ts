import type { InvoicesProps, PaymentDetailsProps } from "@/types/types";

/**
 * Quais blocos de `/billing` têm o que mostrar. Mora fora do JSX por causa do bug que ela substitui:
 * um gate único `permissions && paymentDetails && invoices` derrubava a página toda pra quem é Free,
 * levando junto o consumo de tarefas — que vem de `permissions` e não depende do Stripe.
 */
export function billingSections(
  paymentDetails: PaymentDetailsProps | null | undefined,
  invoices: InvoicesProps[] | undefined,
): { subscription: boolean; invoices: boolean } {
  return {
    subscription: Boolean(paymentDetails),
    invoices: (invoices?.length ?? 0) > 0,
  };
}
