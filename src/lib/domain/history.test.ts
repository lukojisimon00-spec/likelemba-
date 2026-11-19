import { describe, expect, it } from "vitest";
import { describeAuditEntry } from "./history";

describe("describeAuditEntry", () => {
  it("création et modification de groupe", () => {
    expect(describeAuditEntry({ entityType: "groups", action: "insert", details: { name: "Marché" } }).text).toBe(
      "Groupe créé : « Marché »",
    );
    expect(
      describeAuditEntry({
        entityType: "groups",
        action: "update",
        details: { organizer_commission: { old: "10.00", new: "8.00" }, rules: { old: "", new: "x" } },
      }).text,
    ).toBe("Groupe modifié (part du maman likelemba : 10.00 → 8.00 ; règles modifiées)");
  });

  it("membres : ajout, retrait avec motif, invitation acceptée", () => {
    expect(describeAuditEntry({ entityType: "group_members", action: "insert", details: { full_name: "Carol" } }).text).toBe(
      "Membre ajouté : Carol",
    );
    expect(
      describeAuditEntry({
        entityType: "group_members",
        action: "update",
        details: { status: { old: "active", new: "removed" }, removal_reason: { old: null, new: "A déménagé" } },
      }).text,
    ).toBe("Membre retiré (motif : A déménagé)");
    expect(
      describeAuditEntry({ entityType: "group_members", action: "update", details: { profile_id: { old: null, new: "u1" } } })
        .kind,
    ).toBe("invitation");
  });

  it("argent : cotisation, correction, versement, frais", () => {
    expect(
      describeAuditEntry({
        entityType: "contributions",
        action: "insert",
        details: { status: "confirmed", amount: 10, currency: "USD", receipt_number: "SIM-1" },
      }).text,
    ).toBe("Cotisation enregistrée : 10 USD (reçu SIM-1, simulation)");
    expect(
      describeAuditEntry({
        entityType: "contributions",
        action: "update",
        details: { status: { old: "confirmed", new: "cancelled" }, cancellation_reason: { old: null, new: "Erreur" } },
      }).text,
    ).toBe("Cotisation corrigée (annulée) — motif : Erreur");
    expect(
      describeAuditEntry({ entityType: "payout_orders", action: "update", details: { status: { old: "pending", new: "paid" } } })
        .text,
    ).toBe("Cagnotte versée au bénéficiaire (simulation)");
    expect(
      describeAuditEntry({ entityType: "service_fees", action: "update", details: { status: { old: "due", new: "paid" } } }).text,
    ).toBe("Frais LIKELEMBA : à régler → payé");
  });

  it("cycle : changement de statut avec motif", () => {
    expect(
      describeAuditEntry({
        entityType: "cycles",
        action: "update",
        details: { status: { old: "active", new: "cancelled" }, cancellation_reason: { old: null, new: "Test" } },
      }).text,
    ).toBe("Cycle : actif → annulé (motif : Test)");
  });
});
