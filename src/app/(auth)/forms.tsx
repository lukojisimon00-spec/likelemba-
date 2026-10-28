"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "./actions";

export function SignInForm({ suite }: { suite?: string }) {
  const [state, action] = useActionState(signInAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="suite" value={suite ?? ""} />
      <Field
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <Link href="/mot-de-passe-oublie" className="self-end text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
        Mot de passe oublié ?
      </Link>
      <SubmitButton pendingLabel="Connexion…">Se connecter</SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialFormState);
  if (state.success) {
    return (
      <Alert tone="success" title="Vérifiez votre boîte e-mail">
        {state.success}
      </Alert>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="Nom complet"
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        error={state.fieldErrors?.fullName}
      />
      <Field
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Téléphone (facultatif)"
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="0812345678"
        hint="Numéro congolais : Vodacom, Airtel, Orange ou Africell."
        defaultValue={state.values?.phone}
        error={state.fieldErrors?.phone}
      />
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
        error={state.fieldErrors?.password}
      />
      <Field
        label="Confirmez le mot de passe"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm text-ink">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 h-5 w-5 accent-brand-700" required />
          <span>
            J&apos;accepte les{" "}
            <Link href="/mentions-legales" className="font-semibold text-brand-700 underline">
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="font-semibold text-brand-700 underline">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
        {state.fieldErrors?.acceptTerms && (
          <p className="text-sm font-medium text-red-700">{state.fieldErrors.acceptTerms}</p>
        )}
      </div>
      <SubmitButton pendingLabel="Création du compte…">Créer mon compte</SubmitButton>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initialFormState);
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="Adresse e-mail du compte"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Envoi…">Recevoir un lien</SubmitButton>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères.`}
        error={state.fieldErrors?.password}
      />
      <Field
        label="Confirmez le nouveau mot de passe"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      <SubmitButton pendingLabel="Enregistrement…">Enregistrer le mot de passe</SubmitButton>
    </form>
  );
}
