/**
 * États d'un cycle et transitions autorisées.
 * Les transitions sont appliquées par la base (fonctions RPC) ; ce module
 * sert à l'affichage et à n'afficher que les boutons pertinents.
 */

export const CYCLE_STATUSES = ["draft", "preparing", "active", "completed", "cancelled"] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  draft: "Brouillon",
  preparing: "En préparation",
  active: "Actif",
  completed: "Terminé",
  cancelled: "Annulé",
};

export type CycleAction = "prepare" | "returnToDraft" | "start" | "complete" | "cancel";

const TRANSITIONS: Record<CycleAction, { from: CycleStatus[]; to: CycleStatus }> = {
  prepare: { from: ["draft"], to: "preparing" },
  returnToDraft: { from: ["preparing"], to: "draft" },
  start: { from: ["preparing"], to: "active" },
  complete: { from: ["active"], to: "completed" },
  cancel: { from: ["draft", "preparing", "active"], to: "cancelled" },
};

export function canApply(action: CycleAction, status: CycleStatus): boolean {
  return TRANSITIONS[action].from.includes(status);
}

export function nextStatus(action: CycleAction, status: CycleStatus): CycleStatus {
  if (!canApply(action, status)) {
    throw new Error(`Action « ${action} » impossible pour un cycle « ${CYCLE_STATUS_LABELS[status]} ».`);
  }
  return TRANSITIONS[action].to;
}

export function isOpen(status: CycleStatus): boolean {
  return status === "draft" || status === "preparing" || status === "active";
}

/** Participants et ordre des bénéficiaires modifiables uniquement en brouillon. */
export function canEditParticipants(status: CycleStatus): boolean {
  return status === "draft";
}

/**
 * Vérifie qu'un ordre de bénéficiaires est complet : positions 1..n, sans trou ni doublon.
 */
export function validatePayoutOrder(positions: number[]): string | null {
  if (positions.length < 2) return "Un cycle doit compter au moins 2 participants.";
  const sorted = [...positions].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      return `L'ordre des bénéficiaires doit aller de 1 à ${positions.length} sans trou ni doublon.`;
    }
  }
  return null;
}
