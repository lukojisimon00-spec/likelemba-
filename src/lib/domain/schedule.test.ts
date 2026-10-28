import { describe, expect, it } from "vitest";
import { money } from "./money";
import { buildSchedule, computeDueDate, isOverdue, plannedEndDate } from "./schedule";

describe("computeDueDate (identique à private.round_due_date en SQL)", () => {
  it("hebdomadaire et bimensuel", () => {
    expect(computeDueDate("2026-11-02", "weekly", 1)).toBe("2026-11-02");
    expect(computeDueDate("2026-11-02", "weekly", 3)).toBe("2026-11-16");
    expect(computeDueDate("2026-12-21", "weekly", 3)).toBe("2027-01-04");
    expect(computeDueDate("2026-11-02", "biweekly", 2)).toBe("2026-11-16");
  });

  it("mensuel avec fin de mois", () => {
    expect(computeDueDate("2026-01-31", "monthly", 2)).toBe("2026-02-28");
    expect(computeDueDate("2028-01-31", "monthly", 2)).toBe("2028-02-29");
    expect(computeDueDate("2026-01-31", "monthly", 3)).toBe("2026-03-31");
    expect(computeDueDate("2026-11-15", "monthly", 3)).toBe("2027-01-15");
  });

  it("refuse les entrées invalides", () => {
    expect(() => computeDueDate("2026-02-30", "weekly", 1)).toThrow();
    expect(() => computeDueDate("02/11/2026", "weekly", 1)).toThrow();
    expect(() => computeDueDate("2026-11-02", "weekly", 0)).toThrow();
  });
});

describe("buildSchedule", () => {
  it("crée un tour par participant et calcule la cagnotte", () => {
    const rounds = buildSchedule({
      start: "2026-11-02",
      frequency: "weekly",
      participants: 4,
      contribution: money("10", "USD"),
    });
    expect(rounds).toHaveLength(4);
    expect(rounds.map((r) => r.dueDate)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(rounds[0].payout).toEqual({ minor: 4000, currency: "USD" });
    expect(plannedEndDate("2026-11-02", "weekly", 4)).toBe("2026-11-23");
  });

  it("conserve la devise CDF", () => {
    const [first] = buildSchedule({
      start: "2026-01-31",
      frequency: "monthly",
      participants: 2,
      contribution: money("25000", "CDF"),
    });
    expect(first.payout).toEqual({ minor: 5_000_000, currency: "CDF" });
  });

  it("refuse les cycles incohérents", () => {
    const base = { start: "2026-11-02", frequency: "weekly" as const, contribution: money("10", "USD") };
    expect(() => buildSchedule({ ...base, participants: 1 })).toThrow();
    expect(() => buildSchedule({ ...base, participants: 3, contribution: money("0", "USD") })).toThrow();
  });
});

describe("isOverdue", () => {
  it("signale les échéances passées non réglées", () => {
    expect(isOverdue("2026-11-02", "2026-11-03", false)).toBe(true);
    expect(isOverdue("2026-11-02", "2026-11-02", false)).toBe(false);
    expect(isOverdue("2026-11-02", "2026-11-10", true)).toBe(false);
  });
});
