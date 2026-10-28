"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/auth-errors";
import { getSiteUrl, safeRedirectPath } from "@/lib/env";
import { formValues, type FormState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrors,
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

const NOT_CONFIGURED: FormState = {
  error: "Le service d'authentification n'est pas encore configuré (voir README, étape Supabase).",
};

async function siteUrl() {
  return getSiteUrl((await headers()).get("origin"));
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  redirect(safeRedirectPath(formData.get("suite")));
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["fullName", "email", "phone"]);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  if (formData.get("acceptTerms") !== "on") {
    return { fieldErrors: { acceptTerms: "Vous devez accepter les conditions pour continuer." }, values };
  }

  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { fullName, email, phone, password } = parsed.data;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Ces métadonnées servent uniquement à pré-remplir le profil (voir handle_new_user).
      data: { full_name: fullName, phone },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?suite=/tableau-de-bord`,
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  // Si la confirmation par e-mail est désactivée, l'utilisateur est déjà connecté.
  if (data.session) redirect("/tableau-de-bord");

  return {
    success:
      "Compte presque prêt ! Ouvrez l'e-mail que nous venons d'envoyer et cliquez sur le lien de confirmation. Pensez à vérifier les courriers indésirables.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect("/connexion?deconnecte=1");
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?suite=/nouveau-mot-de-passe`,
  });
  // Seules les limites de fréquence sont signalées : on ne révèle pas si l'adresse existe.
  if (error && /rate_limit/.test(error.code ?? "")) return { error: authErrorMessage(error), values };

  return {
    success:
      "Si un compte existe avec cette adresse, vous allez recevoir un e-mail avec un lien pour choisir un nouveau mot de passe.",
  };
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  if (!supabase) return NOT_CONFIGURED;

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { error: "Votre lien a expiré. Demandez un nouveau lien de réinitialisation." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };

  redirect("/tableau-de-bord?mot-de-passe=modifie");
}
