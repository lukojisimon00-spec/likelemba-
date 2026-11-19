/**
 * Partage de la cagnotte d'un tour et frais LIKELEMBA.
 *
 * Modèle décidé par le propriétaire (voir docs/REGLES-METIER.md) :
 * - Cagnotte du tour = cotisation × nombre de participants.
 * - Le responsable du groupe (« maman likelemba ») garde une part fixe par tour,
 *   dans la devise du groupe.
 * - Le bénéficiaire du tour reçoit : cagnotte − part du maman likelemba.
 * - LIKELEMBA prend 1 USD par tour versé, sur la part du maman likelemba.
 *   Rien n'est pris sur la somme du bénéficiaire.
 * - Les frais sont toujours en USD, même pour un groupe en CDF : aucune
 *   conversion automatique (il faudrait un taux enregistré explicitement).
 *
 * Exemple : 10 membres × 10 USD = 100 USD → maman likelemba 10 USD
 * (dont 1 USD pour LIKELEMBA, il lui reste 9 USD), bénéficiaire 90 USD.
 *
 * La valeur de référence des frais est le paramètre `service_fee_amount_usd`
 * en base ; cette constante sert à l'affichage et aux tests.
 */
import { money, multiplyMoney, type Money } from "./money";

export const DEFAULT_SERVICE_FEE: Money = money("1.00", "USD");

export const FEE_STATUS_LABELS = {
  due: "À régler",
  paid: "Réglés (simulation)",
  waived: "Offerts",
  cancelled: "Annulés",
} as const;

export type FeeStatus = keyof typeof FEE_STATUS_LABELS;

export type TurnBreakdown = {
  /** Cagnotte du tour : cotisation × participants. */
  pot: Money;
  /** Part gardée par le maman likelemba (devise du groupe). */
  organizerCommission: Money;
  /** Somme remise au bénéficiaire du tour. */
  beneficiaryAmount: Money;
  /** Frais LIKELEMBA du tour, toujours en USD. */
  likelembaFee: Money;
  /**
   * Ce qu'il reste au maman likelemba après les frais LIKELEMBA.
   * Calculable seulement si le groupe est en USD (sinon null : pas de conversion).
   */
  organizerNet: Money | null;
};

/** Message d'erreur en français si la part du maman likelemba est invalide, sinon null. */
export function validateOrganizerCommission(params: {
  contribution: Money;
  participants: number;
  organizerCommission: Money;
  fee?: Money;
}): string | null {
  const { contribution, participants, organizerCommission, fee = DEFAULT_SERVICE_FEE } = params;
  if (organizerCommission.currency !== contribution.currency) {
    return "La part du maman likelemba doit être dans la devise du groupe.";
  }
  if (organizerCommission.minor <= 0) {
    return "Indiquez la part du maman likelemba par tour.";
  }
  const pot = multiplyMoney(contribution, participants);
  if (organizerCommission.minor >= pot.minor) {
    return "La part du maman likelemba doit être inférieure à la cagnotte du tour.";
  }
  if (organizerCommission.currency === "USD" && organizerCommission.minor < fee.minor) {
    return "En dollars, la part du maman likelemba doit être d'au moins 1 USD : les frais LIKELEMBA sont pris dessus.";
  }
  return null;
}

/** Détail d'un tour. Identique au calcul de start_cycle() et mark_payout_paid_simulated() en SQL. */
export function computeTurnBreakdown(params: {
  contribution: Money;
  participants: number;
  organizerCommission: Money;
  fee?: Money;
}): TurnBreakdown {
  const { contribution, participants, organizerCommission, fee = DEFAULT_SERVICE_FEE } = params;
  if (fee.currency !== "USD") {
    throw new Error("Les frais LIKELEMBA sont toujours exprimés en USD.");
  }
  if (!Number.isInteger(participants) || participants < 2) {
    throw new Error("Un cycle doit compter au moins 2 participants.");
  }
  if (contribution.minor <= 0) {
    throw new Error("La cotisation doit être supérieure à zéro.");
  }
  const error = validateOrganizerCommission({ contribution, participants, organizerCommission, fee });
  if (error) throw new Error(error);

  const pot = multiplyMoney(contribution, participants);
  return {
    pot,
    organizerCommission,
    beneficiaryAmount: { minor: pot.minor - organizerCommission.minor, currency: pot.currency },
    likelembaFee: fee,
    organizerNet:
      organizerCommission.currency === "USD"
        ? { minor: organizerCommission.minor - fee.minor, currency: "USD" }
        : null,
  };
}

/** Total des frais LIKELEMBA pour un nombre de tours versés (toujours en USD). */
export function serviceFeesForTurns(turns: number, fee: Money = DEFAULT_SERVICE_FEE): Money {
  if (fee.currency !== "USD") {
    throw new Error("Les frais LIKELEMBA sont toujours exprimés en USD.");
  }
  if (!Number.isInteger(turns) || turns < 0) {
    throw new Error("Le nombre de tours doit être un entier positif.");
  }
  return { minor: fee.minor * turns, currency: "USD" };
}
