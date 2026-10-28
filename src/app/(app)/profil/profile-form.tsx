"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { updateProfileAction } from "./actions";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <Field
        label="Nom complet"
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName ?? fullName}
        error={state.fieldErrors?.fullName}
      />
      <Field
        label="Téléphone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0812345678"
        defaultValue={state.values?.phone ?? phone}
        error={state.fieldErrors?.phone}
      />
      <SubmitButton pendingLabel="Enregistrement…" className="sm:w-auto">
        Enregistrer
      </SubmitButton>
    </form>
  );
}
