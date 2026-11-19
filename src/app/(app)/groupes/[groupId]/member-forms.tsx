"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, SelectField, buttonClass } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { addMemberAction, archiveGroupAction, removeMemberAction } from "../actions";

export function AddMemberForm({ groupId }: { groupId: string }) {
  const [state, action] = useActionState(addMemberAction, initialFormState);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet" name="fullName" required autoComplete="off" defaultValue={v.fullName} error={e.fullName} />
        <Field
          label="Téléphone (WhatsApp)"
          name="phone"
          type="tel"
          inputMode="tel"
          placeholder="0812345678"
          hint="Facultatif, mais nécessaire pour le contacter sur WhatsApp."
          defaultValue={v.phone}
          error={e.phone}
        />
        <SelectField
          label="Rôle"
          name="role"
          defaultValue={v.role ?? "member"}
          options={[
            { value: "member", label: "Membre" },
            { value: "treasurer", label: "Trésorier (aide à enregistrer les cotisations)" },
          ]}
          error={e.role}
        />
      </div>
      <SubmitButton pendingLabel="Ajout…" className="sm:w-auto sm:self-start">
        Ajouter le membre
      </SubmitButton>
    </form>
  );
}

export function RemoveMemberForm({ groupId, memberId, name }: { groupId: string; memberId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(removeMemberAction, initialFormState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("ghost", "text-sm text-red-700")}>
        Retirer
      </button>
    );
  }
  return (
    <form action={action} className="mt-3 flex w-full flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-3" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="memberId" value={memberId} />
      <p className="text-sm text-red-900">
        Retirer <strong>{name}</strong> du groupe ? Sa fiche et son historique restent conservés.
      </p>
      <Field
        label="Motif du retrait"
        name="reason"
        required
        defaultValue={state.values?.reason}
        error={state.fieldErrors?.reason}
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="danger" pendingLabel="Retrait…" className="w-auto">
          Confirmer le retrait
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary")}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export function ArchiveGroupForm({ groupId }: { groupId: string }) {
  const [state, action] = useActionState(archiveGroupAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="groupId" value={groupId} />
      <label className="flex min-h-12 items-center gap-3 text-sm">
        <input type="checkbox" name="confirm" className="h-5 w-5 accent-brand-700" />
        Je confirme : le groupe ne pourra plus être modifié (l&apos;historique reste visible).
      </label>
      <SubmitButton variant="secondary" pendingLabel="Archivage…" className="sm:w-auto sm:self-start">
        Archiver le groupe
      </SubmitButton>
    </form>
  );
}
