import { describe, expect, it } from "vitest";
import { formatDate, todayIso } from "./dates";

describe("dates", () => {
  it("calcule la date du jour à Kinshasa", () => {
    // 23h30 UTC le 31 décembre = déjà le 1er janvier à Kinshasa (UTC+1)
    expect(todayIso("Africa/Kinshasa", new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(todayIso("Africa/Kinshasa", new Date("2026-12-31T12:00:00Z"))).toBe("2026-12-31");
  });

  it("affiche une date en français", () => {
    expect(formatDate("2026-11-02")).toBe("lundi 2 novembre 2026");
  });
});
