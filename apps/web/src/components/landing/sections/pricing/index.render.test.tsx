/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { PLAN_PRICING, formatPrice } from "@dailify/shared";

import { Pricing } from ".";
import { copy } from "./copy";

const price = (cents: number) => formatPrice(cents).replace(/\u00a0/g, " ");

describe("<Pricing>", () => {
  it("troca mensal → anual e mostra a economia", async () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(screen.getByText(price(PLAN_PRICING.pro.monthly))).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: new RegExp(copy.billing.yearly) }));
    expect(screen.getByText(price(PLAN_PRICING.max.yearly))).toBeInTheDocument();
    expect(screen.getByText(copy.save.replace("{price}", price(1980)))).toBeInTheDocument();
    // créditos vêm de QUOTAS, não de número digitado no copy
    expect(screen.getByText("1.000 créditos de IA por mês")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.plans.free.cta })).toHaveAttribute(
      "href",
      "/signup",
    );
  });
});
