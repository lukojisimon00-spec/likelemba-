import { describe, expect, it } from "vitest";
import {
  DEFAULT_SERVICE_FEE,
  computeTurnBreakdown,
  serviceFeesForTurns,
  validateOrganizerCommission,
} from "./fees";
import { money } from "./money";

describe("partage d'un tour", () => {
  it("exemple du propriétaire : 10 membres × 10 USD, maman likelemba 10 USD", () => {
    const t = computeTurnBreakdown({
      contribution: money("10", "USD"),
      participants: 10,
      organizerCommission: money("10", "USD"),
    });
    expect(t.pot).toEqual({ minor: 10_000, currency: "USD" });
    expect(t.beneficiaryAmount).toEqual({ minor: 9_000, currency: "USD" });
    expect(t.organizerCommission).toEqual({ minor: 1_000, currency: "USD" });
    expect(t.likelembaFee).toEqual({ minor: 100, currency: "USD" });
    expect(t.organizerNet).toEqual({ minor: 900, currency: "USD" });
  });

  it("groupe en CDF : frais en USD, aucune conversion", () => {
    const t = computeTurnBreakdown({
      contribution: money("25000", "CDF"),
      participants: 4,
      organizerCommission: money("25000", "CDF"),
    });
    expect(t.pot).toEqual({ minor: 10_000_000, currency: "CDF" });
    expect(t.beneficiaryAmount).toEqual({ minor: 7_500_000, currency: "CDF" });
    expect(t.likelembaFee.currency).toBe("USD");
    expect(t.organizerNet).toBeNull();
  });

  it("refuse une part invalide", () => {
    const base = { contribution: money("10", "USD"), participants: 4 };
    expect(validateOrganizerCommission({ ...base, organizerCommission: money("0", "USD") })).toMatch(/Indiquez/);
    expect(validateOrganizerCommission({ ...base, organizerCommission: money("0.50", "USD") })).toMatch(/1 USD/);
    expect(validateOrganizerCommission({ ...base, organizerCommission: money("40", "USD") })).toMatch(/inférieure/);
    expect(validateOrganizerCommission({ ...base, organizerCommission: money("1000", "CDF") })).toMatch(/devise/);
    expect(validateOrganizerCommission({ ...base, organizerCommission: money("4", "USD") })).toBeNull();
    expect(() => computeTurnBreakdown({ ...base, organizerCommission: money("40", "USD") })).toThrow();
  });
});

describe("frais de service", () => {
  it("1 USD par tour versé", () => {
    expect(DEFAULT_SERVICE_FEE).toEqual({ minor: 100, currency: "USD" });
    expect(serviceFeesForTurns(10)).toEqual({ minor: 1_000, currency: "USD" });
  });

  it("toujours en USD, jamais convertis", () => {
    expect(() => serviceFeesForTurns(1, money(2800, "CDF"))).toThrow();
  });
});
