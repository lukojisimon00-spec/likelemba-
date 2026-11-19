import { describe, expect, it } from "vitest";
import { dbErrorMessage } from "@/lib/data/db-errors";
import { groupRow, groupSchema, memberSchema, removeMemberSchema } from "./group";

const valid = {
  name: "  Likelemba du marché  ",
  description: "",
  currency: "USD",
  contributionAmount: "10",
  organizerCommission: "10",
  frequency: "monthly",
  maxMembers: "10",
  rules: "",
};

describe("groupSchema", () => {
  it("accepte l'exemple du propriétaire et prépare les colonnes SQL", () => {
    const r = groupSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(groupRow(r.data)).toEqual({
      name: "Likelemba du marché",
      description: "",
      currency: "USD",
      contribution_amount: "10.00",
      organizer_commission: "10.00",
      frequency: "monthly",
      max_members: 10,
      rules: "",
    });
  });

  it("accepte les montants avec virgule et espaces (CDF)", () => {
    const r = groupSchema.safeParse({ ...valid, currency: "CDF", contributionAmount: "25 000", organizerCommission: "2500,50" });
    expect(r.success && r.data.contributionAmount).toBe("25000.00");
    expect(r.success && r.data.organizerCommission).toBe("2500.50");
  });

  it.each([
    [{ organizerCommission: "100" }, "organizerCommission"],
    [{ organizerCommission: "0,50" }, "organizerCommission"],
    [{ contributionAmount: "-5" }, "contributionAmount"],
    [{ contributionAmount: "abc" }, "contributionAmount"],
    [{ maxMembers: "501" }, "maxMembers"],
    [{ maxMembers: "1" }, "maxMembers"],
    [{ currency: "EUR" }, "currency"],
    [{ name: "A" }, "name"],
  ])("refuse %o", (override, field) => {
    const r = groupSchema.safeParse({ ...valid, ...override });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe(field);
  });
});

describe("memberSchema", () => {
  it("normalise le téléphone et accepte l'absence de numéro", () => {
    expect(memberSchema.parse({ fullName: "Carol", phone: "099 111 2233", role: "member" }).phone).toBe("+243991112233");
    expect(memberSchema.parse({ fullName: "Dan", phone: "", role: "treasurer" }).phone).toBeNull();
  });

  it("refuse le rôle de responsable et un numéro étranger", () => {
    expect(memberSchema.safeParse({ fullName: "X Y", phone: "", role: "manager" }).success).toBe(false);
    expect(memberSchema.safeParse({ fullName: "X Y", phone: "+33612345678", role: "member" }).success).toBe(false);
  });

  it("motif de retrait obligatoire", () => {
    expect(removeMemberSchema.safeParse({ reason: "abc" }).success).toBe(false);
    expect(removeMemberSchema.safeParse({ reason: "A déménagé" }).success).toBe(true);
  });
});

describe("dbErrorMessage", () => {
  it("affiche les messages métier de la base, masque les erreurs techniques", () => {
    expect(dbErrorMessage({ code: "P0001", message: "Le groupe a atteint son nombre maximal de membres (5)." })).toMatch(/maximal/);
    expect(dbErrorMessage({ code: "23505", message: "duplicate key value violates…" })).toMatch(/déjà/);
    expect(dbErrorMessage({ code: "42501", message: "permission denied" })).toMatch(/Accès refusé/);
    expect(dbErrorMessage({ code: "XX000", message: "stack trace interne" })).not.toMatch(/interne/);
  });
});
