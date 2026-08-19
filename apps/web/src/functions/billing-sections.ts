import type { InvoicesProps, PaymentDetailsProps } from "@/types/types";

// Substitui gate único que apagava a página inteira. O gate antigo
// `permissions && paymentDetails && invoices` escondia até o consumo de tarefas.
export function billingSections(
  paymentDetails: PaymentDetailsProps | null | undefined,
  invoices: InvoicesProps[] | undefined,
): { subscription: boolean; invoices: boolean } {
  return {
    subscription: Boolean(paymentDetails),
    invoices: (invoices?.length ?? 0) > 0,
  };
}
