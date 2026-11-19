"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, SelectField, buttonClass } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { whatsappLink, whatsappShareLink } from "@/lib/domain/phone";
import {
  addMemberAction,
  archiveGroupAction,
  createInvitationAction,
  removeMemberAction,
  revokeInvitationAction,
} from "../actions";

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

/** Lien d'invitation personnel : création puis partage (WhatsApp, Facebook/Messenger/SMS via le téléphone, copie). */
export function InviteMemberPanel({
  memberId,
  memberName,
  phone,
  groupName,
  pending,
  groupId,
}: {
  memberId: string;
  memberName: string;
  phone: string | null;
  groupName: string;
  /** Invitation encore valable (id et date d'expiration), si elle existe. */
  pending: { invitationId: string; expiresLabel: string } | null;
  groupId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createInvitationAction, initialFormState);
  const [revokeState, revokeAction] = useActionState(revokeInvitationAction, initialFormState);
  const [copied, setCopied] = useState(false);
  const link = state.values?.link;
  const message = link
    ? `Bonjour ${memberName}, je t'invite à rejoindre notre likelemba « ${groupName} » sur LIKELEMBA. ` +
      `Ouvre ce lien personnel (valable 14 jours) : ${link}`
    : "";
  const wa = link ? (phone ? whatsappLink(phone, message) : null) ?? whatsappShareLink(message) : null;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "text-sm")}>
        {pending ? "Invitation envoyée" : "Inviter"}
      </button>
    );
  }
  return (
    <div className="mt-2 flex w-full flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
      {pending && !link && (
        <p>
          Un lien a déjà été créé (valable jusqu&apos;au {pending.expiresLabel}). Pour des raisons de sécurité, il
          n&apos;est pas réaffiché : créez-en un nouveau (l&apos;ancien sera annulé) ou annulez-le.
        </p>
      )}
      {!link && (
        <p>
          Créez un lien personnel pour <strong>{memberName}</strong>. En l&apos;ouvrant, cette personne crée son compte
          (ou se connecte) et rejoint le groupe. Le lien est à usage unique.
        </p>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {revokeState.error && <Alert tone="error">{revokeState.error}</Alert>}
      {revokeState.success && <Alert tone="success">{revokeState.success}</Alert>}
      {link ? (
        <>
          <p className="font-semibold text-brand-900">Lien prêt. Envoyez-le uniquement à {memberName} :</p>
          <p className="rounded-lg bg-white p-2 font-mono text-xs break-all">{link}</p>
          <div className="flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "text-sm")}>
                Envoyer sur WhatsApp
              </a>
            )}
            {canShare && (
              <button
                type="button"
                className={buttonClass("secondary", "text-sm")}
                onClick={() => navigator.share({ title: "Invitation LIKELEMBA", text: message }).catch(() => {})}
              >
                Partager (Messenger, SMS…)
              </button>
            )}
            <button
              type="button"
              className={buttonClass("secondary", "text-sm")}
              onClick={() =>
                navigator.clipboard
                  ?.writeText(message)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false))
              }
            >
              {copied ? "✓ Copié" : "Copier le message"}
            </button>
          </div>
          <p className="text-xs text-muted">
            Ne publiez pas ce lien sur un mur ou un groupe public : il permet de rejoindre le groupe à la place de{" "}
            {memberName}.
          </p>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <form action={action}>
            <input type="hidden" name="memberId" value={memberId} />
            <SubmitButton pendingLabel="Création…" className="w-auto text-sm">
              {pending ? "Créer un nouveau lien" : "Créer le lien d'invitation"}
            </SubmitButton>
          </form>
          {pending && !revokeState.success && (
            <form action={revokeAction}>
              <input type="hidden" name="invitationId" value={pending.invitationId} />
              <input type="hidden" name="groupId" value={groupId} />
              <SubmitButton variant="ghost" pendingLabel="Annulation…" className="w-auto text-sm text-red-700">
                Annuler le lien
              </SubmitButton>
            </form>
          )}
          <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "text-sm")}>
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
