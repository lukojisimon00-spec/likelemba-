"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, SelectField } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { updateMemberAction } from "../../../actions";

export function EditMemberForm({
  groupId,
  memberId,
  isManager,
  defaults,
}: {
  groupId: string;
  memberId: string;
  isManager: boolean;
  defaults: { fullName: string; phone: string; role: "member" | "treasurer" };
}) {
  const [state, action] = useActionState(updateMemberAction, initialFormState);
  const v = { ...defaults, ...state.values };
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="isManager" value={isManager ? "1" : "0"} />
      <Field label="Nom complet" name="fullName" required defaultValue={v.fullName} error={e.fullName} />
      <Field
        label="Téléphone (WhatsApp)"
        name="phone"
        type="tel"
        inputMode="tel"
        placeholder="0812345678"
        defaultValue={v.phone}
        error={e.phone}
      />
      {isManager ? (
        <p className="text-sm text-muted">Rôle : maman likelemba (responsable) — ne peut pas être changé ici.</p>
      ) : (
        <SelectField
          label="Rôle"
          name="role"
          defaultValue={v.role}
          options={[
            { value: "member", label: "Membre" },
            { value: "treasurer", label: "Trésorier (aide à enregistrer les cotisations)" },
          ]}
          error={e.role}
        />
      )}
      <SubmitButton pendingLabel="Enregistrement…" className="sm:w-auto sm:self-start">
        Enregistrer
      </SubmitButton>
    </form>
  );
}
