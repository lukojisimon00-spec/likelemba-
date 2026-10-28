import { describe, expect, it } from "vitest";
import {
  addMoney,
  CurrencyMismatchError,
  formatMoney,
  money,
  multiplyMoney,
  sumMoney,
  toDecimalString,
  toMinor,
} from "./money";

// Intl utilise des espaces insécables : on les normalise pour comparer.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("toMinor", () => {
  it("convertit les montants saisis en centimes", () => {
    expect(toMinor("10")).toBe(1000);
    expect(toMinor("10.5")).toBe(1050);
    expect(toMinor("10,50")).toBe(1050);
    expect(toMinor(" 25 000 ")).toBe(2_500_000);
    expect(toMinor(0.1)).toBe(10);
  });

  it("refuse les montants invalides ou trop précis", () => {
    expect(() => toMinor("abc")).toThrow();
    expect(() => toMinor("10.555")).toThrow();
    expect(() => toMinor("")).toThrow();
  });
});

describe("opérations sur les montants", () => {
  it("additionne sans erreur d'arrondi", () => {
    expect(addMoney(money("0.1", "USD"), money("0.2", "USD"))).toEqual({ minor: 30, currency: "USD" });
  });

  it("ne mélange jamais USD et CDF", () => {
    expect(() => addMoney(money(1, "USD"), money(2500, "CDF"))).toThrow(CurrencyMismatchError);
    expect(() => sumMoney([money(1, "USD"), money(1, "CDF")], "USD")).toThrow(CurrencyMismatchError);
  });

  it("multiplie uniquement par un entier", () => {
    expect(multiplyMoney(money("10", "USD"), 4).minor).toBe(4000);
    expect(() => multiplyMoney(money("10", "USD"), 1.5)).toThrow();
  });

  it("produit la chaîne décimale attendue par PostgreSQL", () => {
    expect(toDecimalString(money("1234.5", "CDF"))).toBe("1234.50");
    expect(toDecimalString(money("0.05", "USD"))).toBe("0.05");
  });
});

describe("formatMoney", () => {
  it("affiche les montants en français", () => {
    expect(plain(formatMoney(money("25000", "CDF")))).toBe("25 000 FC");
    expect(plain(formatMoney(money("10.5", "USD")))).toBe("10,50 $US");
  });
});
