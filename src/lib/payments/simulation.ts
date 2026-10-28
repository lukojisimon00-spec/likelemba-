/**
 * Fournisseur de SIMULATION — aucun argent réel n'est déplacé.
 *
 * Il répond comme le ferait un prestataire, ce qui permet de tester les
 * parcours (succès, échec, nouvelle tentative) sans compte marchand.
 * Les enregistrements en base sont créés par la fonction SQL
 * record_simulated_contribution(), qui refuse toute opération non simulée.
 */
import type {
  CollectionRequest,
  CollectionResult,
  PaymentProvider,
  PaymentStatus,
  VerifiedWebhookEvent,
} from "./types";

export const SIMULATION_NOTICE = "SIMULATION — AUCUN ARGENT RÉEL";

export type SimulationOptions = {
  /** Force un échec, pour tester l'affichage des opérations échouées. */
  simulateFailure?: boolean;
};

export class SimulationPaymentProvider implements PaymentProvider {
  readonly id = "simulation";
  readonly isSimulation = true;

  private readonly results = new Map<string, CollectionResult>();

  constructor(private readonly options: SimulationOptions = {}) {}

  async createCollection(request: CollectionRequest): Promise<CollectionResult> {
    if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) {
      throw new Error("Le montant doit être un nombre entier de centimes supérieur à zéro.");
    }
    // Idempotence : la même clé renvoie toujours le même résultat.
    const existing = this.results.get(request.idempotencyKey);
    if (existing) return existing;

    const result: CollectionResult = this.options.simulateFailure
      ? {
          status: "failed",
          providerReference: `sim_${crypto.randomUUID().replaceAll("-", "")}`,
          failureReason: "Échec simulé (test)",
        }
      : {
          status: "confirmed",
          providerReference: `sim_${crypto.randomUUID().replaceAll("-", "")}`,
        };
    this.results.set(request.idempotencyKey, result);
    return result;
  }

  async getCollectionStatus(providerReference: string): Promise<PaymentStatus> {
    for (const result of this.results.values()) {
      if (result.providerReference === providerReference) return result.status;
    }
    throw new Error("Opération simulée introuvable.");
  }

  async verifyWebhook(): Promise<VerifiedWebhookEvent> {
    // Le simulateur n'envoie pas de webhook : tout appel externe est refusé.
    throw new Error("Le fournisseur de simulation n'accepte aucun webhook.");
  }
}
