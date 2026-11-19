"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, SelectField, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { validateOrganizerCommission } from "@/lib/domain/fees";
import { formatMoney, type Money } from "@/lib/domain/money";
import { buildSchedule, type Frequency } from "@/lib/domain/schedule";
import { initialFormState, type FormState } from "@/lib/forms/state";
import {
  cancelContributionAction,
  cancelCycleAction,
  completeCycleAction,
  launchCycleAction,
  payFeeAction,
  payoutAction,
  recordContributionsAction,
} from "./actions";

type Member = { id: string; name: string };

const smallBtn =
  "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-lg font-bold text-brand-700 disabled:opacity-30";

/** Préparation d'un cycle : participants, ordre des tours, date de début, aperçu du calendrier. */
export function CycleSetupForm({
  groupId,
  members,
  initialOrder,
  defaultStartDate,
  frequency,
  contribution,
  organizerCommission,
}: {
  groupId: string;
  members: Member[];
  initialOrder: string[];
  defaultStartDate: string;
  frequency: Frequency;
  contribution: Money;
  organizerCommission: Money;
}) {
  const [state, action] = useActionState(launchCycleAction, initialFormState);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const [order, setOrder] = useState<string[]>(() => {
    const known = initialOrder.filter((id) => byId.has(id));
    return [...known, ...members.map((m) => m.id).filter((id) => !known.includes(id))];
  });
  const [excluded, setExcluded] = useState<Set<string>>(
    () => new Set(initialOrder.length ? members.map((m) => m.id).filter((id) => !initialOrder.includes(id)) : []),
  );
  const [startDate, setStartDate] = useState(defaultStartDate);

  const included = order.filter((id) => !excluded.has(id));
  const move = (index: number, delta: number) =>
    setOrder((o) => {
      const next = [...o];
      const j = index + delta;
      if (j < 0 || j >= next.length) return o;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  const shuffle = () =>
    setOrder((o) => {
      const next = [...o];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });

  const problem =
    included.length < 2
      ? "Choisissez au moins 2 participants."
      : validateOrganizerCommission({ contribution, participants: included.length, organizerCommission });
  let schedule: ReturnType<typeof buildSchedule> = [];
  if (!problem && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    try {
      schedule = buildSchedule({ start: startDate, frequency, participants: included.length, contribution, organizerCommission });
    } catch {
      schedule = [];
    }
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="groupId" value={groupId} />
      {included.map((id) => (
        <input key={id} type="hidden" name="memberIds" value={id} />
      ))}

      <Field
        label="Date du premier tour"
        name="startDate"
        type="date"
        required
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        error={state.fieldErrors?.startDate}
        className="sm:max-w-xs"
      />

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-bold text-ink">Ordre des tours ({included.length} participants)</h3>
            <p className="text-sm text-muted">Le premier de la liste reçoit la cagnotte au tour 1.</p>
          </div>
          <button type="button" onClick={shuffle} className={buttonClass("secondary", "text-sm")}>
            🎲 Tirage au sort
          </button>
        </div>
        <ol className="mt-3 flex flex-col gap-2">
          {order.map((id, i) => {
            const m = byId.get(id)!;
            const isOut = excluded.has(id);
            const position = isOut ? null : included.indexOf(id) + 1;
            return (
              <li
                key={id}
                className={`flex items-center gap-2 rounded-xl border p-2 ${isOut ? "border-dashed border-line bg-cream" : "border-line bg-white"}`}
              >
                <span className="w-14 shrink-0 text-center text-sm font-bold text-brand-700">
                  {position ? `Tour ${position}` : "—"}
                </span>
                <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!isOut}
                    onChange={() =>
                      setExcluded((s) => {
                        const n = new Set(s);
                        if (n.has(id)) n.delete(id);
                        else n.add(id);
                        return n;
                      })
                    }
                    className="h-5 w-5 shrink-0 accent-brand-700"
                    aria-label={`${m.name} participe`}
                  />
                  <span className={`break-words ${isOut ? "text-muted line-through" : "font-semibold"}`}>{m.name}</span>
                </label>
                <button type="button" className={smallBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${m.name}`}>
                  ↑
                </button>
                <button
                  type="button"
                  className={smallBtn}
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Descendre ${m.name}`}
                >
                  ↓
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <section aria-label="Calendrier prévu" className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <h3 className="font-bold text-brand-900">Calendrier prévu</h3>
        {problem ? (
          <p className="mt-2 text-sm font-medium text-red-700">{problem}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              À chaque tour, chacun verse {formatMoney(contribution)}. Le bénéficiaire reçoit{" "}
              <strong className="text-brand-900">{schedule[0] && formatMoney(schedule[0].payout)}</strong>.
            </p>
            <ol className="mt-3 divide-y divide-brand-200 text-sm">
              {schedule.map((r) => (
                <li key={r.round} className="flex flex-wrap justify-between gap-x-3 py-2">
                  <span>
                    <strong>Tour {r.round}</strong> · {formatDate(r.dueDate)}
                  </span>
                  <span className="font-semibold text-brand-900">{byId.get(included[r.round - 1])?.name}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <p className="text-sm text-muted">
        Une fois le cycle démarré, l&apos;ordre des tours ne peut plus être modifié (il faudrait annuler le cycle).
      </p>
      <SubmitButton pendingLabel="Démarrage…" className="sm:w-auto sm:self-start">
        Démarrer le cycle
      </SubmitButton>
    </form>
  );
}

export type ContributionRow = {
  participantId: string;
  name: string;
  status: "paid" | "late" | "todo";
  receiptNumber: string | null;
  paidAt: string | null;
  key: string;
  /** Lien WhatsApp de rappel (membre qui n'a pas payé et dont le numéro est connu). */
  reminderHref?: string | null;
};

/** Pointage des cotisations d'un tour : cases à cocher pour ceux qui ont payé. */
export function ContributionsForm({
  groupId,
  scheduleId,
  round,
  rows,
  canRecord,
}: {
  groupId: string;
  scheduleId: string;
  round: number;
  rows: ContributionRow[];
  canRecord: boolean;
}) {
  const [state, action] = useActionState(recordContributionsAction, initialFormState);
  const unpaid = rows.filter((r) => r.status !== "paid");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const allChecked = unpaid.length > 0 && checked.size === unpaid.length;

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="scheduleId" value={scheduleId} />
      <input type="hidden" name="round" value={round} />

      {canRecord && unpaid.length > 1 && (
        <label className="flex min-h-12 items-center gap-3 text-sm font-semibold text-brand-700">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand-700"
            checked={allChecked}
            onChange={() => setChecked(allChecked ? new Set() : new Set(unpaid.map((r) => r.participantId)))}
          />
          Tout cocher ({unpaid.length} pas encore payé{unpaid.length > 1 ? "s" : ""})
        </label>
      )}

      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const pill =
            r.status === "paid"
              ? "bg-brand-100 text-brand-900"
              : r.status === "late"
                ? "bg-red-100 text-red-800"
                : "bg-cream text-muted";
          const label = r.status === "paid" ? "✓ A payé" : r.status === "late" ? "En retard" : "Pas encore payé";
          return (
            <li key={r.participantId} className="flex items-center gap-3 py-2">
              {canRecord && r.status !== "paid" ? (
                <input
                  type="checkbox"
                  name="participantIds"
                  value={r.participantId}
                  checked={checked.has(r.participantId)}
                  onChange={() =>
                    setChecked((s) => {
                      const n = new Set(s);
                      if (n.has(r.participantId)) n.delete(r.participantId);
                      else n.add(r.participantId);
                      return n;
                    })
                  }
                  className="h-6 w-6 shrink-0 accent-brand-700"
                  aria-label={`${r.name} a payé`}
                  id={`p-${r.participantId}`}
                />
              ) : (
                <span className="w-6 shrink-0" />
              )}
              {canRecord && r.status !== "paid" && <input type="hidden" name={`key_${r.participantId}`} value={r.key} />}
              <label htmlFor={`p-${r.participantId}`} className="flex min-h-12 min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="font-semibold break-words text-ink">{r.name}</span>
                <span className="flex flex-col items-end">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${pill}`}>{label}</span>
                  {r.receiptNumber && <span className="mt-0.5 text-xs text-muted">Reçu {r.receiptNumber}</span>}
                </span>
              </label>
              {r.reminderHref && (
                <a
                  href={r.reminderHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 shrink-0 items-center rounded-xl px-2 text-xs font-semibold text-[#1f7a43] underline"
                  aria-label={`Envoyer un rappel WhatsApp à ${r.name}`}
                >
                  Rappel WhatsApp
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {canRecord && unpaid.length > 0 && (
        <div className="sticky bottom-2 rounded-2xl bg-white/95 p-2 shadow-lg ring-1 ring-line">
          <SubmitButton pendingLabel="Enregistrement…">
            {checked.size > 0
              ? `Enregistrer ${checked.size} paiement${checked.size > 1 ? "s" : ""} (simulation)`
              : "Cochez ceux qui ont payé"}
          </SubmitButton>
        </div>
      )}
    </form>
  );
}

/** Petit formulaire « un bouton » avec message d'erreur. */
function OneButton({
  action,
  hidden,
  label,
  pendingLabel,
  variant = "primary",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  hidden: Record<string, string | number>;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} pendingLabel={pendingLabel} className="w-full sm:w-auto">
        {label}
      </SubmitButton>
    </form>
  );
}

export function PayoutButton(props: { groupId: string; payoutId: string; round: number; label: string }) {
  return (
    <OneButton
      action={payoutAction}
      hidden={{ groupId: props.groupId, payoutId: props.payoutId, round: props.round }}
      label={props.label}
      pendingLabel="Versement…"
    />
  );
}

export function PayFeeButton(props: { groupId: string; feeId: string }) {
  return (
    <OneButton
      action={payFeeAction}
      hidden={{ groupId: props.groupId, feeId: props.feeId }}
      label="Régler (simulation)"
      pendingLabel="Règlement…"
      variant="secondary"
    />
  );
}

export function CompleteCycleButton(props: { groupId: string; cycleId: string }) {
  return (
    <OneButton
      action={completeCycleAction}
      hidden={{ groupId: props.groupId, cycleId: props.cycleId }}
      label="Terminer le cycle"
      pendingLabel="Clôture…"
    />
  );
}

export function CancelCycleForm({ groupId, cycleId }: { groupId: string; cycleId: string }) {
  const [state, action] = useActionState(cancelCycleAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="cycleId" value={cycleId} />
      <Field label="Motif de l'annulation" name="reason" required defaultValue={state.values?.reason} error={state.fieldErrors?.reason} />
      <SubmitButton variant="danger" pendingLabel="Annulation…" className="sm:w-auto sm:self-start">
        Annuler le cycle
      </SubmitButton>
    </form>
  );
}

/** Correction d'une cotisation enregistrée par erreur (avant le versement du tour). */
export function CorrectContributionForm({
  groupId,
  round,
  options,
}: {
  groupId: string;
  round: number;
  options: { contributionId: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(cancelContributionAction, initialFormState);
  // Envoi manuel : React vide sinon le formulaire après une erreur, et le choix serait perdu.
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="round" value={round} />
      <SelectField
        label="Cotisation à corriger"
        name="contributionId"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        options={[{ value: "", label: "Choisir…" }, ...options.map((o) => ({ value: o.contributionId, label: o.label }))]}
        error={state.fieldErrors?.contributionId}
      />
      <Field
        label="Motif de la correction"
        name="reason"
        required
        placeholder="Ex. : enregistrée par erreur, la personne n'a pas encore payé"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={state.fieldErrors?.reason}
      />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={buttonClass("secondary", "sm:w-auto sm:self-start")}
      >
        {pending ? "Correction…" : "Annuler cette cotisation"}
      </button>
    </form>
  );
}
