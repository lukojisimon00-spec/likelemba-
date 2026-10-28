/**
 * Frais de service LIKELEMBA.
 *
 * - 1 USD par groupe et par cycle, dus à la préparation du cycle.
 * - Toujours exprimés en USD, même pour un groupe en CDF.
 * - Jamais déduits des sommes destinées aux membres.
 * - Aucune conversion automatique en CDF : un taux devra être défini et
 *   enregistré explicitement (non prévu dans le MVP).
 *
 * La valeur de référence est le paramètre `service_fee_amount_usd` en base ;
 * cette constante sert à l'affichage et aux tests.
 */
import { money, type Money } from "./money";

export const DEFAULT_SERVICE_FEE: Money = money("1.00", "USD");

export const FEE_STATUS_LABELS = {
  due: "À régler",
  paid: "Réglés (simulation)",
  waived: "Offerts",
  cancelled: "Annulés",
} as const;

export type FeeStatus = keyof typeof FEE_STATUS_LABELS;

/** Total des frais pour un nombre de cycles donné (toujours en USD). */
export function serviceFeesForCycles(cycles: number, fee: Money = DEFAULT_SERVICE_FEE): Money {
  if (fee.currency !== "USD") {
    throw new Error("Les frais LIKELEMBA sont toujours exprimés en USD.");
  }
  if (!Number.isInteger(cycles) || cycles < 0) {
    throw new Error("Le nombre de cycles doit être un entier positif.");
  }
  return { minor: fee.minor * cycles, currency: "USD" };
}
