/**
 * Contrat commun à tous les fournisseurs de paiement.
 *
 * L'application ne parle qu'à cette interface : remplacer le fournisseur
 * (simulation aujourd'hui, prestataire agréé demain) ne doit pas obliger à
 * réécrire le reste du SaaS. Voir docs/PAIEMENTS.md.
 *
 * Règles imposées à toute implémentation réelle :
 * - le statut d'un paiement est vérifié côté serveur, auprès du fournisseur,
 *   jamais sur la seule déclaration du navigateur ;
 * - chaque webhook est authentifié (signature) avant d'être traité ;
 * - chaque opération porte une clé d'idempotence pour éviter les doubles traitements ;
 * - aucune donnée d'authentification (PIN, mot de passe, OTP) ne transite par LIKELEMBA.
 */
import type { Currency } from "@/lib/domain/money";

export type PaymentStatus = "pending" | "confirmed" | "failed";

export type CollectionRequest = {
  /** Clé unique fournie par LIKELEMBA, réutilisée en cas de nouvelle tentative. */
  idempotencyKey: string;
  /** Montant en centimes. */
  amountMinor: number;
  currency: Currency;
  description: string;
};

export type CollectionResult = {
  status: PaymentStatus;
  providerReference: string;
  failureReason?: string;
};

export type VerifiedWebhookEvent = {
  providerReference: string;
  idempotencyKey: string;
  status: PaymentStatus;
};

export interface PaymentProvider {
  readonly id: string;
  /** true pour le fournisseur de simulation : aucune somme réelle n'est déplacée. */
  readonly isSimulation: boolean;

  /** Demande d'encaissement d'une cotisation. */
  createCollection(request: CollectionRequest): Promise<CollectionResult>;

  /** Vérifie l'état d'une opération auprès du fournisseur (source de vérité). */
  getCollectionStatus(providerReference: string): Promise<PaymentStatus>;

  /**
   * Authentifie puis interprète un webhook. Doit lever une erreur si la
   * signature est absente ou invalide.
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedWebhookEvent>;
}
