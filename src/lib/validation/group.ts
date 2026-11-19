import { z } from "zod";
import { validateOrganizerCommission } from "@/lib/domain/fees";
import { CURRENCIES, money, toDecimalString, toMinor } from "@/lib/domain/money";
import { normalizeDrcPhone } from "@/lib/domain/phone";
import { FREQUENCIES } from "@/lib/domain/schedule";

export const MAX_MEMBERS_LIMIT = 500;

/** Montant saisi (« 10 », « 10,50 », « 25 000 ») → chaîne décimale pour PostgreSQL. */
function amount(label: string) {
  return z.string().trim().transform((value, ctx) => {
    try {
      const minor = toMinor(value.replace(/\s/g, ""));
      if (minor <= 0 || minor > 100_000_000_000) throw new Error();
      return toDecimalString({ minor, currency: "USD" });
    } catch {
      ctx.addIssue({ code: "custom", message: `${label} : indiquez un montant positif (ex. 10 ou 10,50).` });
      return z.NEVER;
    }
  });
}

const optionalPhone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const normalized = normalizeDrcPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Numéro invalide. Exemple : 0812345678 ou +243812345678." });
      return z.NEVER;
    }
    return normalized;
  });

export const groupSchema = z
  .object({
    name: z.string().trim().min(2, { error: "Le nom doit contenir au moins 2 caractères." }).max(80, {
      error: "Le nom est trop long (80 caractères maximum).",
    }),
    description: z.string().trim().max(1000, { error: "La description est trop longue." }),
    currency: z.enum(CURRENCIES, { error: "Choisissez la devise : USD ou CDF." }),
    contributionAmount: amount("Cotisation"),
    organizerCommission: amount("Part du maman likelemba"),
    frequency: z.enum(FREQUENCIES, { error: "Choisissez la fréquence des cotisations." }),
    maxMembers: z.coerce
      .number({ error: "Indiquez un nombre." })
      .int({ error: "Indiquez un nombre entier." })
      .min(2, { error: "Au moins 2 membres." })
      .max(MAX_MEMBERS_LIMIT, { error: `Au plus ${MAX_MEMBERS_LIMIT} membres.` }),
    rules: z.string().trim().max(4000, { error: "Les règles sont trop longues." }),
  })
  .superRefine((d, ctx) => {
    // Contrôle sur un groupe complet ; la base revérifie avec le nombre réel de participants.
    const message = validateOrganizerCommission({
      contribution: money(d.contributionAmount, d.currency),
      participants: d.maxMembers,
      organizerCommission: money(d.organizerCommission, d.currency),
    });
    if (message) ctx.addIssue({ code: "custom", path: ["organizerCommission"], message });
  });

export type GroupInput = z.infer<typeof groupSchema>;

/** Colonnes SQL correspondant au formulaire (seules colonnes que le navigateur peut écrire). */
export function groupRow(d: GroupInput) {
  return {
    name: d.name,
    description: d.description,
    currency: d.currency,
    contribution_amount: d.contributionAmount,
    organizer_commission: d.organizerCommission,
    frequency: d.frequency,
    max_members: d.maxMembers,
    rules: d.rules,
  };
}

export const MEMBER_ROLES = ["member", "treasurer"] as const;
export const MEMBER_ROLE_LABELS = {
  manager: "Maman likelemba (responsable)",
  treasurer: "Trésorier",
  member: "Membre",
} as const;

export const memberSchema = z.object({
  fullName: z.string().trim().min(2, { error: "Indiquez le nom du membre." }).max(120, {
    error: "Le nom est trop long.",
  }),
  phone: optionalPhone,
  role: z.enum(MEMBER_ROLES, { error: "Rôle invalide." }),
});

export const removeMemberSchema = z.object({
  reason: z.string().trim().min(5, { error: "Indiquez le motif (au moins 5 caractères)." }).max(500, {
    error: "Le motif est trop long.",
  }),
});

const uuid = z.uuid({ error: "Identifiant invalide." });
export const idSchema = uuid;
