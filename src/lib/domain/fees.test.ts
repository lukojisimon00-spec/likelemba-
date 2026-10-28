import { describe, expect, it } from "vitest";
import { DEFAULT_SERVICE_FEE, serviceFeesForCycles } from "./fees";
import { money } from "./money";

describe("frais de service", () => {
  it("1 USD par cycle", () => {
    expect(DEFAULT_SERVICE_FEE).toEqual({ minor: 100, currency: "USD" });
    expect(serviceFeesForCycles(3)).toEqual({ minor: 300, currency: "USD" });
  });

  it("toujours en USD, jamais convertis", () => {
    expect(() => serviceFeesForCycles(1, money(2800, "CDF"))).toThrow();
  });
});
