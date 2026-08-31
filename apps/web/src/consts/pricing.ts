/**
 * O preço mora em `@dailify/shared` (`PLAN_PRICING`, em centavos): é lá que o servidor consegue
 * comparar o anunciado com o cobrado pelo Stripe. Este arquivo só mantém o caminho de import que
 * as telas já usavam.
 */
export { PLAN_PRICING, PRICING_CURRENCY, formatPrice, yearlySavings } from "@dailify/shared";
export type { PlanRole } from "@dailify/shared";
