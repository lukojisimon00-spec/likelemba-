"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, SelectField, TextAreaField } from "@/components/ui";
import { computeTurnBreakdown, validateOrganizerCommission } from "@/lib/domain/fees";
import { CURRENCY_LABELS, formatMoney, money, type Currency } from "@/lib/domain/money";
import { FREQUENCY_LABELS, FREQUENCIES } from "@/lib/domain/schedule";
import { initialFormState, type FormState } from "@/lib/forms/state";

export type GroupFormDefaults = {
  name: string;
  description: string;
  currency: Currency;
  contributionAmount: string;
  organizerCommission: string;
  frequency: string;
  maxMembers: string;
  rules: string;
};

const EMPTY: GroupFormDefaults = {
  name: "",
  description: "",
  currency: "USD",
  contributionAmount: "",
  organizerCommission: "",
  frequency: "monthly",
  maxMembers: "10",
  rules: "",
};

function safeMoney(value: string, currency: Currency) {
  try {
    return money(value.replace(/\s/g, ""), currency);
  } catch {
    return null;
  }
}

/** Aperçu d'un tour pour un groupe complet, recalculé à chaque saisie. */
function TurnPreview({
  currency,
  contribution,
  commission,
  members,
}: {
  currency: Currency;
  contribution: string;
  commission: string;
  members: string;
}) {
  const c = safeMoney(contribution, currency);
  const k = safeMoney(commission, currency);
  const n = Number(members);
  if (!c || c.minor <= 0 || !k || !Number.isInteger(n) || n < 2) {
    return (
      <p className="text-sm text-muted">
        Remplissez la cotisation, la part du maman likelemba et le nombre de membres pour voir le calcul d&apos;un
        tour.
      </p>
    );
  }
  const problem = validateOrganizerCommission({ contribution: c, participants: n, organizerCommission: k });
  if (problem) return <p className="text-sm font-medium text-red-700">{problem}</p>;
  const t = computeTurnBreakdown({ contribution: c, participants: n, organizerCommission: k });
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted">
        Cagnotte ({n} × {formatMoney(c)})
      </dt>
      <dd className="text-right font-semibold tabular-nums">{formatMoney(t.pot)}</dd>
      <dt className="font-semibold text-brand-900">Le bénéficiaire du tour reçoit</dt>
      <dd className="text-right text-lg font-extrabold text-brand-700 tabular-nums">
        {formatMoney(t.beneficiaryAmount)}
      </dd>
      <dt className="text-muted">Part du maman likelemba</dt>
      <dd className="text-right font-semibold tabular-nums">{formatMoney(t.organizerCommission)}</dd>
      <dt className="text-muted">dont frais LIKELEMBA (sur la part du maman likelemba)</dt>
      <dd className="text-right font-semibold tabular-nums">{formatMoney(t.likelembaFee)}</dd>
      {t.organizerNet ? (
        <>
          <dt className="text-muted">Il reste au maman likelemba</dt>
          <dd className="text-right font-semibold tabular-nums">{formatMoney(t.organizerNet)}</dd>
        </>
      ) : (
        <p className="col-span-2 text-xs text-muted">
          Groupe en francs congolais : les frais LIKELEMBA restent de 1 USD par tour, sans conversion automatique.
        </p>
      )}
    </dl>
  );
}

export function GroupForm({
  action,
  defaults = EMPTY,
  groupId,
  currencyLocked = false,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: GroupFormDefaults;
  groupId?: string;
  currencyLocked?: boolean;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = { ...defaults, ...state.values } as GroupFormDefaults;
  const errors = state.fieldErrors ?? {};

  // Valeurs suivies en direct pour l'aperçu (les champs restent non contrôlés pour le reste).
  const [currency, setCurrency] = useState<Currency>(v.currency);
  const [contribution, setContribution] = useState(v.contributionAmount);
  const [commission, setCommission] = useState(v.organizerCommission);
  const [members, setMembers] = useState(v.maxMembers);
  const [commissionTouched, setCommissionTouched] = useState(v.organizerCommission !== "");

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {groupId && <input type="hidden" name="groupId" value={groupId} />}

      <Field label="Nom du groupe" name="name" required maxLength={80} defaultValue={v.name} error={errors.name} />

      {currencyLocked ? (
        <>
          <input type="hidden" name="currency" value={currency} />
          <p className="text-sm">
            <span className="font-semibold">Devise :</span> {CURRENCY_LABELS[currency]}
            <span className="block text-muted">La devise ne change plus une fois qu&apos;un cycle a été créé.</span>
          </p>
        </>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-ink">Devise du groupe</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["USD", "CDF"] as const).map((code) => (
              <label
                key={code}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-center font-semibold ${
                  currency === code ? "border-brand-700 bg-brand-50 text-brand-900" : "border-line bg-white text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="currency"
                  value={code}
                  checked={currency === code}
                  onChange={() => setCurrency(code)}
                  className="sr-only"
                />
                {code === "USD" ? "Dollars (USD)" : "Francs congolais (CDF)"}
              </label>
            ))}
          </div>
          {errors.currency && <p className="text-sm font-medium text-red-700">{errors.currency}</p>}
        </fieldset>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={`Cotisation par membre et par tour (${currency})`}
          name="contributionAmount"
          inputMode="decimal"
          placeholder={currency === "USD" ? "10" : "25000"}
          required
          value={contribution}
          onChange={(e) => {
            setContribution(e.target.value);
            // Proposition par défaut : une cotisation, comme dans la pratique courante.
            if (!commissionTouched) setCommission(e.target.value);
          }}
          error={errors.contributionAmount}
        />
        <Field
          label={`Part du maman likelemba par tour (${currency})`}
          name="organizerCommission"
          inputMode="decimal"
          required
          value={commission}
          onChange={(e) => {
            setCommission(e.target.value);
            setCommissionTouched(true);
          }}
          hint="Gardée par vous à chaque tour. Proposée : une cotisation."
          error={errors.organizerCommission}
        />
        <SelectField
          label="Fréquence des cotisations"
          name="frequency"
          defaultValue={v.frequency}
          options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABELS[f] }))}
          error={errors.frequency}
        />
        <Field
          label="Nombre maximal de membres"
          name="maxMembers"
          type="number"
          inputMode="numeric"
          min={2}
          max={500}
          required
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          hint="Entre 2 et 500. Vous pourrez le changer plus tard."
          error={errors.maxMembers}
        />
      </div>

      <section aria-label="Calcul d'un tour" className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <h2 className="mb-3 font-bold text-brand-900">Exemple d&apos;un tour (groupe complet)</h2>
        <TurnPreview currency={currency} contribution={contribution} commission={commission} members={members} />
      </section>

      <TextAreaField
        label="Description (facultatif)"
        name="description"
        maxLength={1000}
        defaultValue={v.description}
        error={errors.description}
      />
      <TextAreaField
        label="Règles du groupe (facultatif)"
        name="rules"
        maxLength={4000}
        rows={4}
        placeholder="Ex. : cotisation chaque 1er du mois ; en cas de retard, prévenir la maman likelemba."
        defaultValue={v.rules}
        error={errors.rules}
      />

      <SubmitButton pendingLabel="Enregistrement…" className="sm:w-auto sm:self-start">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
