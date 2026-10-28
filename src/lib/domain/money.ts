/**
 * Montants et devises.
 *
 * Règles LIKELEMBA :
 * - Deux devises seulement : USD et CDF.
 * - Les calculs se font en centimes entiers (pas de nombres à virgule flottante).
 * - On n'additionne JAMAIS deux devises différentes : une erreur est levée.
 * - Aucune conversion automatique n'existe dans ce module.
 */

export const CURRENCIES = ["USD", "CDF"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Money = {
  /** Montant en centimes (1 USD = 100 ; 1 CDF = 100). */
  minor: number;
  currency: Currency;
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "Dollar américain (USD)",
  CDF: "Franc congolais (CDF)",
};

export class CurrencyMismatchError extends Error {
  constructor(a: Currency, b: Currency) {
    super(`Impossible de combiner des montants en ${a} et en ${b}.`);
    this.name = "CurrencyMismatchError";
  }
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Convertit un montant saisi ou renvoyé par la base ("10", "10.5", "10,50", 10.5)
 * en centimes. Refuse plus de deux décimales et les valeurs invalides.
 */
export function toMinor(value: string | number): number {
  const text = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new Error(`Montant invalide : « ${value} ».`);
  }
  const [, sign, units, decimals = ""] = match;
  const minor = Number(units) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Montant trop élevé : « ${value} ».`);
  }
  return sign ? -minor : minor;
}

export function money(value: string | number, currency: Currency): Money {
  return { minor: toMinor(value), currency };
}

/** Représentation décimale attendue par PostgreSQL : "1234.50". */
export function toDecimalString(m: Money): string {
  const sign = m.minor < 0 ? "-" : "";
  const abs = Math.abs(m.minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
  return { minor: a.minor + b.minor, currency: a.currency };
}

export function multiplyMoney(a: Money, factor: number): Money {
  if (!Number.isInteger(factor)) {
    throw new Error("Le multiplicateur doit être un nombre entier.");
  }
  return { minor: a.minor * factor, currency: a.currency };
}

/** Somme d'une liste de montants de même devise. */
export function sumMoney(items: Money[], currency: Currency): Money {
  return items.reduce((total, item) => addMoney(total, item), { minor: 0, currency });
}

/** Affichage en français : « 25 000 FC », « 10,50 $US ». */
export function formatMoney(m: Money): string {
  const hasCents = m.minor % 100 !== 0;
  return new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: m.currency === "CDF" && !hasCents ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(m.minor / 100);
}
