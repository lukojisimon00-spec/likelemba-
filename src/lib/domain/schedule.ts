/**
 * Calendrier d'un cycle de likelemba.
 *
 * Règle retenue pour le MVP (voir docs/REGLES-METIER.md) :
 * - Un cycle compte autant de tours que de participants.
 * - À chaque tour, chaque participant (bénéficiaire compris) verse la cotisation.
 * - Cagnotte du tour : cotisation × nombre de participants.
 * - Le bénéficiaire reçoit : cagnotte − part du maman likelemba (voir fees.ts).
 * - Les frais LIKELEMBA (1 USD) sont pris sur la part du maman likelemba,
 *   jamais sur la somme du bénéficiaire.
 *
 * Doit rester identique à la fonction SQL private.round_due_date().
 */
import { computeTurnBreakdown } from "./fees";
import { type Money } from "./money";

export const FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Chaque semaine",
  biweekly: "Toutes les deux semaines",
  monthly: "Chaque mois",
};

/** Date au format AAAA-MM-JJ, sans fuseau horaire. */
export type IsoDate = string;

function parseIsoDate(date: IsoDate): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Date invalide : « ${date} ».`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new Error(`Date invalide : « ${date} ».`);
  }
  return { y, m, d };
}

function formatIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Date d'échéance du tour `round` (1 = premier tour, à la date de début). */
export function computeDueDate(start: IsoDate, frequency: Frequency, round: number): IsoDate {
  if (!Number.isInteger(round) || round < 1) {
    throw new Error("Le numéro de tour doit être un entier supérieur ou égal à 1.");
  }
  const { y, m, d } = parseIsoDate(start);
  const offset = round - 1;

  if (frequency === "monthly") {
    // Même comportement que PostgreSQL : on ramène au dernier jour du mois si besoin.
    const targetMonth = m - 1 + offset;
    const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
    return formatIsoDate(new Date(Date.UTC(y, targetMonth, Math.min(d, lastDay))));
  }

  const days = frequency === "weekly" ? 7 : 14;
  return formatIsoDate(new Date(Date.UTC(y, m - 1, d + days * offset)));
}

export type ScheduleRound = {
  round: number;
  dueDate: IsoDate;
  /** Position dans l'ordre des bénéficiaires (= numéro du tour). */
  beneficiaryPosition: number;
  /** Cagnotte du tour (cotisation × participants). */
  pot: Money;
  /** Somme remise au bénéficiaire (cagnotte − part du maman likelemba). */
  payout: Money;
};

/** Aperçu du calendrier complet avant le démarrage d'un cycle. */
export function buildSchedule(params: {
  start: IsoDate;
  frequency: Frequency;
  participants: number;
  contribution: Money;
  organizerCommission: Money;
}): ScheduleRound[] {
  const { start, frequency, participants, contribution, organizerCommission } = params;
  const { pot, beneficiaryAmount } = computeTurnBreakdown({ contribution, participants, organizerCommission });
  return Array.from({ length: participants }, (_, i) => ({
    round: i + 1,
    dueDate: computeDueDate(start, frequency, i + 1),
    beneficiaryPosition: i + 1,
    pot,
    payout: beneficiaryAmount,
  }));
}

export function plannedEndDate(start: IsoDate, frequency: Frequency, participants: number): IsoDate {
  return computeDueDate(start, frequency, participants);
}

/** Une échéance est en retard si sa date est passée et que la cotisation n'est pas confirmée. */
export function isOverdue(dueDate: IsoDate, today: IsoDate, confirmed: boolean): boolean {
  return !confirmed && dueDate < today;
}
