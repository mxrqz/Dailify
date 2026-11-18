import type { Invoice, PaymentDetails } from "@dailify/shared";

// Substitui gate único que apagava a página inteira. O gate antigo
// `permissions && paymentDetails && invoices` escondia até o consumo de tarefas.
export function billingSections(
  paymentDetails: PaymentDetails | null | undefined,
  invoices: Invoice[] | undefined,
): { subscription: boolean; invoices: boolean } {
  return {
    subscription: Boolean(paymentDetails),
    invoices: (invoices?.length ?? 0) > 0,
  };
}
