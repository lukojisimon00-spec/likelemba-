import { SimulationPaymentProvider, type SimulationOptions } from "./simulation";
import type { PaymentProvider } from "./types";

export type { PaymentProvider } from "./types";
export { SIMULATION_NOTICE } from "./simulation";

/**
 * Seul le mode « simulation » existe dans le MVP. Toute autre valeur de
 * PAYMENTS_MODE est refusée explicitement, pour ne jamais activer par
 * erreur un fournisseur réel non vérifié.
 */
export function getPaymentProvider(options?: SimulationOptions): PaymentProvider {
  const mode = process.env.PAYMENTS_MODE ?? "simulation";
  if (mode !== "simulation") {
    throw new Error(
      `PAYMENTS_MODE="${mode}" n'est pas pris en charge. Seul le mode "simulation" est disponible.`,
    );
  }
  return new SimulationPaymentProvider(options);
}
