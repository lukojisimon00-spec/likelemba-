/** Libellés lisibles pour le journal d'audit. */
const ENTITY_LABELS: Record<string, string> = {
  groups: "Groupe",
  group_members: "Membre",
  cycles: "Cycle",
  cycle_participants: "Ordre des bénéficiaires",
  contributions: "Cotisation",
  payout_orders: "Versement",
  service_fees: "Frais LIKELEMBA",
  payment_destinations: "Moyen de réception",
  profiles: "Profil",
  platform_settings: "Paramètre",
  platform_admins: "Administrateur",
};

const ACTION_LABELS: Record<string, string> = {
  insert: "ajouté",
  update: "modifié",
  delete: "supprimé",
  admin_set_account_status: "statut du compte modifié",
};

export function describeActivity(entityType: string, action: string): string {
  const entity = ENTITY_LABELS[entityType] ?? entityType;
  const verb = ACTION_LABELS[action] ?? action;
  return `${entity} : ${verb}`;
}
