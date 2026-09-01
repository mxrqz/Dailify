/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PlanCards } from "./plan-cards";
import { PLAN_PRICING, formatPrice } from "@/consts/pricing";
import { copy } from "./copy";

/** `formatPrice` usa espaço não separável; o normalizador do RTL só mexe no lado do DOM. */
const price = (cents: number) => formatPrice(cents).replace(/\u00a0/g, " ");

const renderCards = () =>
  render(
    <PlanCards
      roles={["free", "pro", "pro+ai"]}
      recommended="pro"
      renderCta={(role) => <button>assinar {role}</button>}
    />,
  );

describe("<PlanCards>", () => {
  it("abre no mensal e mostra o preço mensal de cada plano pago", () => {
    renderCards();
    expect(screen.getByText(price(PLAN_PRICING.pro.monthly))).toBeInTheDocument();
    expect(screen.getByText(price(PLAN_PRICING["pro+ai"].monthly))).toBeInTheDocument();
    expect(screen.queryByText(price(PLAN_PRICING.pro.yearly))).not.toBeInTheDocument();
  });

  it("o toggle troca para os preços anuais", async () => {
    renderCards();
    await userEvent.click(screen.getByRole("button", { name: new RegExp(copy.billing.yearly) }));

    expect(screen.getByText(price(PLAN_PRICING.pro.yearly))).toBeInTheDocument();
    expect(screen.getByText(price(PLAN_PRICING["pro+ai"].yearly))).toBeInTheDocument();
    expect(screen.queryByText(price(PLAN_PRICING.pro.monthly))).not.toBeInTheDocument();
  });

  // O bug que motivou a issue 040: a página anunciava "ilimitado" para quem tinha limite.
  it("Free anuncia o limite real, não 'ilimitado'", () => {
    renderCards();
    expect(screen.getByText(/30 tarefas\/mês/i)).toBeInTheDocument();
  });

  it("marca o plano recomendado e rende um CTA por plano", () => {
    renderCards();
    expect(screen.getByText(copy.billing.recommendedBadge)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^assinar/ })).toHaveLength(3);
  });
});
