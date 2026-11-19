/**
 * Traduction des lignes du journal d'audit (audit_logs) en phrases lisibles.
 * Le journal est rempli automatiquement par la base (déclencheurs) et ne peut
 * être ni modifié ni supprimé. Ce module ne fait que l'affichage.
 */

export type AuditEntry = {
  entityType: string;
  action: string; // insert | update | delete | autre
  details: Record<string, unknown>;
};

export type HistoryLine = {
  text: string;
  /** Catégorie pour le filtrage et l'icône. */
  kind: "groupe" | "membre" | "cycle" | "argent" | "frais" | "invitation" | "technique";
};

type Change = { old: unknown; new: unknown };

function change(details: Record<string, unknown>, key: string): Change | null {
  const v = details[key];
  if (v && typeof v === "object" && "new" in (v as object)) return v as Change;
  return null;
}

const STATUS_FR: Record<string, string> = {
  draft: "brouillon",
  preparing: "en préparation",
  active: "actif",
  completed: "terminé",
  cancelled: "annulé",
  archived: "archivé",
  removed: "retiré",
  paid: "payé",
  due: "à régler",
  pending: "en attente",
  confirmed: "confirmé",
  failed: "échoué",
  waived: "offert",
};

const GROUP_FIELDS_FR: Record<string, string> = {
  name: "nom",
  description: "description",
  contribution_amount: "cotisation",
  organizer_commission: "part du maman likelemba",
  frequency: "fréquence",
  max_members: "nombre maximal de membres",
  rules: "règles",
  currency: "devise",
  status: "statut",
};

const s = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
const fr = (v: unknown) => STATUS_FR[s(v)] ?? s(v);

export function describeAuditEntry({ entityType, action, details }: AuditEntry): HistoryLine {
  const d = details ?? {};
  switch (entityType) {
    case "groups": {
      if (action === "insert") return { kind: "groupe", text: `Groupe créé : « ${s(d.name)} »` };
      const parts = Object.keys(GROUP_FIELDS_FR)
        .map((k) => {
          const c = change(d, k);
          if (!c) return null;
          if (k === "rules" || k === "description") return `${GROUP_FIELDS_FR[k]} modifiées`;
          if (k === "status") return `statut : ${fr(c.old)} → ${fr(c.new)}`;
          return `${GROUP_FIELDS_FR[k]} : ${s(c.old)} → ${s(c.new)}`;
        })
        .filter(Boolean);
      return { kind: "groupe", text: parts.length ? `Groupe modifié (${parts.join(" ; ")})` : "Groupe modifié" };
    }
    case "group_members": {
      if (action === "insert") return { kind: "membre", text: `Membre ajouté : ${s(d.full_name)}` };
      const st = change(d, "status");
      if (st?.new === "removed") {
        const reason = change(d, "removal_reason")?.new;
        return { kind: "membre", text: `Membre retiré${reason ? ` (motif : ${s(reason)})` : ""}` };
      }
      if (change(d, "profile_id")?.new) return { kind: "invitation", text: "Un membre a rattaché son compte (invitation acceptée)" };
      const name = change(d, "full_name");
      const role = change(d, "role");
      const parts = [
        name && `nom : ${s(name.old)} → ${s(name.new)}`,
        change(d, "phone") && "téléphone modifié",
        role && `rôle : ${s(role.old)} → ${s(role.new)}`,
      ].filter(Boolean);
      return { kind: "membre", text: parts.length ? `Membre modifié (${parts.join(" ; ")})` : "Membre modifié" };
    }
    case "cycles": {
      if (action === "insert") return { kind: "cycle", text: `Cycle n° ${s(d.cycle_number)} créé (début ${s(d.start_date)})` };
      const st = change(d, "status");
      if (st) {
        const reason = change(d, "cancellation_reason")?.new;
        return { kind: "cycle", text: `Cycle : ${fr(st.old)} → ${fr(st.new)}${reason ? ` (motif : ${s(reason)})` : ""}` };
      }
      const start = change(d, "start_date");
      if (start) return { kind: "cycle", text: `Date de début du cycle : ${s(start.old)} → ${s(start.new)}` };
      return { kind: "technique", text: "Cycle mis à jour" };
    }
    case "cycle_participants":
      return {
        kind: "technique",
        text:
          action === "insert"
            ? `Participant placé au tour ${s(d.payout_position)}`
            : action === "delete"
              ? "Participant retiré de l'ordre des tours"
              : "Ordre des tours modifié",
      };
    case "contributions": {
      if (action === "insert") {
        return d.status === "failed"
          ? { kind: "argent", text: "Cotisation : échec simulé" }
          : { kind: "argent", text: `Cotisation enregistrée : ${s(d.amount)} ${s(d.currency)} (reçu ${s(d.receipt_number)}, simulation)` };
      }
      const st = change(d, "status");
      if (st?.new === "cancelled") {
        const reason = change(d, "cancellation_reason")?.new;
        return { kind: "argent", text: `Cotisation corrigée (annulée)${reason ? ` — motif : ${s(reason)}` : ""}` };
      }
      return { kind: "argent", text: "Cotisation mise à jour" };
    }
    case "payout_orders": {
      if (action === "insert") return { kind: "technique", text: `Versement prévu : ${s(d.amount)} ${s(d.currency)}` };
      const st = change(d, "status");
      if (st?.new === "paid") return { kind: "argent", text: "Cagnotte versée au bénéficiaire (simulation)" };
      if (st) return { kind: "argent", text: `Versement : ${fr(st.old)} → ${fr(st.new)}` };
      return { kind: "technique", text: "Versement mis à jour" };
    }
    case "service_fees": {
      if (action === "insert") return { kind: "frais", text: `Frais LIKELEMBA dus : ${s(d.amount)} ${s(d.currency)}` };
      const st = change(d, "status");
      return { kind: "frais", text: st ? `Frais LIKELEMBA : ${fr(st.old)} → ${fr(st.new)}` : "Frais LIKELEMBA mis à jour" };
    }
    case "group_invitations": {
      if (action === "insert") return { kind: "invitation", text: "Lien d'invitation créé" };
      if (change(d, "accepted_at")?.new) return { kind: "invitation", text: "Invitation acceptée" };
      if (change(d, "revoked_at")?.new) return { kind: "invitation", text: "Lien d'invitation annulé ou remplacé" };
      return { kind: "invitation", text: "Invitation mise à jour" };
    }
    case "payment_destinations":
      return { kind: "membre", text: "Coordonnées de réception modifiées (masquées)" };
    default:
      return { kind: "technique", text: `${entityType} : ${action}` };
  }
}
