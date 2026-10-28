import { describe, expect, it } from "vitest";
import { canApply, canEditParticipants, nextStatus, validatePayoutOrder } from "./cycle";

describe("transitions de cycle", () => {
  it("suit brouillon → préparation → actif → terminé", () => {
    expect(nextStatus("prepare", "draft")).toBe("preparing");
    expect(nextStatus("start", "preparing")).toBe("active");
    expect(nextStatus("complete", "active")).toBe("completed");
  });

  it("refuse les transitions dangereuses", () => {
    expect(canApply("start", "draft")).toBe(false);
    expect(canApply("cancel", "completed")).toBe(false);
    expect(() => nextStatus("prepare", "active")).toThrow();
  });

  it("participants modifiables seulement en brouillon", () => {
    expect(canEditParticipants("draft")).toBe(true);
    expect(canEditParticipants("preparing")).toBe(false);
    expect(canEditParticipants("active")).toBe(false);
  });
});

describe("validatePayoutOrder", () => {
  it("accepte un ordre complet", () => {
    expect(validatePayoutOrder([3, 1, 2])).toBeNull();
  });
  it("refuse trous, doublons et cycles trop petits", () => {
    expect(validatePayoutOrder([1, 2, 4])).not.toBeNull();
    expect(validatePayoutOrder([1, 1, 2])).not.toBeNull();
    expect(validatePayoutOrder([1])).not.toBeNull();
  });
});
