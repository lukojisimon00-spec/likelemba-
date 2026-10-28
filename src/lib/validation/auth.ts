import { z } from "zod";
import { normalizeDrcPhone } from "@/lib/domain/phone";

export const PASSWORD_MIN_LENGTH = 8;

// Nettoyage avant validation : les espaces ajoutés par les claviers mobiles sont fréquents.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Adresse e-mail invalide." }).max(254, { error: "Adresse e-mail trop longue." }));

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.` })
  .max(72, { error: "Le mot de passe est trop long (72 caractères maximum)." });

const fullName = z
  .string()
  .trim()
  .min(2, { error: "Indiquez votre nom complet." })
  .max(120, { error: "Le nom est trop long." });

/** Téléphone facultatif ; normalisé au format +243XXXXXXXXX s'il est fourni. */
const optionalPhone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const normalized = normalizeDrcPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Numéro invalide. Exemple : 0812345678 ou +243812345678.",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Indiquez votre mot de passe." }),
});

export const signUpSchema = z
  .object({
    fullName,
    email,
    phone: optionalPhone,
    password,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    error: "Les deux mots de passe ne sont pas identiques.",
  });

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    error: "Les deux mots de passe ne sont pas identiques.",
  });

export const profileSchema = z.object({ fullName, phone: optionalPhone });

/** Erreurs par champ, prêtes à afficher sous chaque champ du formulaire. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
