import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, SimulationBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getCurrentCycle, getCycleView, getDraftOrder, type CycleView } from "@/lib/data/cycles";
import { getGroupDetail, type GroupDetail } from "@/lib/data/groups";
import { formatDate, formatDateTime, todayIso } from "@/lib/dates";
import { CYCLE_STATUS_LABELS } from "@/lib/domain/cycle";
import { FEE_STATUS_LABELS, serviceFeesForTurns } from "@/lib/domain/fees";
import { formatMoney } from "@/lib/domain/money";
import { isOverdue } from "@/lib/domain/schedule";
import { idSchema } from "@/lib/validation/group";
import {
  CancelCycleForm,
  CompleteCycleButton,
  ContributionsForm,
  CycleSetupForm,
  PayFeeButton,
  PayoutButton,
  type ContributionRow,
} from "./cycle-forms";

export const metadata: Metadata = { title: "Suivi du cycle" };

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-2xl font-extrabold tabular-nums ${tone === "warn" ? "text-red-700" : "text-brand-900"}`}>{value}</p>
    </div>
  );
}

function Notices({ q }: { q: Record<string, string | string[] | undefined> }) {
  const n = Number(q.enregistre);
  return (
    <>
      {q.demarre === "1" && (
        <Alert tone="success" title="Cycle démarré">
          Le calendrier est créé. Cochez les membres au fur et à mesure qu&apos;ils paient.
        </Alert>
      )}
      {n > 0 && <Alert tone="success">{n} paiement{n > 1 ? "s" : ""} enregistré{n > 1 ? "s" : ""} (simulation).</Alert>}
      {q.verse === "1" && <Alert tone="success">Versement enregistré (simulation). Les frais LIKELEMBA du tour (1 USD) sont à régler.</Alert>}
      {q.frais === "1" && <Alert tone="success">Frais LIKELEMBA réglés (simulation).</Alert>}
      {q.termine === "1" && <Alert tone="success">Cycle terminé : tout le monde a reçu son tour.</Alert>}
      {q.annule === "1" && <Alert tone="warning">Cycle annulé. L&apos;historique est conservé.</Alert>}
    </>
  );
}

function Tracking({ group, view, canRecord, q }: { group: GroupDetail; view: CycleView; canRecord: boolean; q: Record<string, string | string[] | undefined> }) {
  const { cycle, rounds, members, selectedRound, contributions, today } = view;
  const round = rounds.find((r) => r.round === selectedRound)!;
  const byParticipant = new Map(members.map((m) => [m.participantId, m]));
  const beneficiary = byParticipant.get(round.beneficiaryParticipantId);
  const active = cycle.status === "active";
  const filter = q.filtre === "paye" || q.filtre === "attente" ? q.filtre : "tous";

  const allRows: ContributionRow[] = members.map((m) => {
    const c = contributions[m.participantId];
    const paid = c?.status === "confirmed";
    return {
      participantId: m.participantId,
      name: m.fullName,
      status: paid ? "paid" : isOverdue(round.dueDate, today, false) ? "late" : "todo",
      receiptNumber: c?.receiptNumber ?? null,
      paidAt: c?.paidAt ?? null,
      key: crypto.randomUUID(),
    };
  });
  const paidCount = allRows.filter((r) => r.status === "paid").length;
  const rows = allRows
    .filter((r) => (filter === "paye" ? r.status === "paid" : filter === "attente" ? r.status !== "paid" : true))
    // Ceux qui n'ont pas payé d'abord : c'est la liste utile au maman likelemba.
    .sort((a, b) => Number(a.status === "paid") - Number(b.status === "paid"));

  const paidOut = rounds.filter((r) => r.payout?.status === "paid").length;
  const lateMembers = members.filter((m) => m.lateCount > 0).length;
  const allPaid = paidCount === members.length;
  const base = `/groupes/${group.id}/cycle`;
  const roundLink = (n: number, extra = "") => `${base}?tour=${n}${extra}`;
  const filterLink = (f: string) => `${base}?tour=${selectedRound}${f === "tous" ? "" : `&filtre=${f}`}`;

  return (
    <>
      <section aria-label="Résumé" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tour affiché" value={`${selectedRound} / ${rounds.length}`} />
        <Stat label="Ont payé ce tour" value={`${paidCount} / ${members.length}`} />
        <Stat label="Cagnottes versées" value={`${paidOut} / ${rounds.length}`} />
        <Stat label="Membres en retard" value={String(lateMembers)} tone={lateMembers ? "warn" : "default"} />
      </section>

      <Card>
        <nav aria-label="Choisir un tour" className="flex flex-wrap items-center justify-between gap-2">
          {selectedRound > 1 ? (
            <Link href={roundLink(selectedRound - 1)} className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-brand-700 hover:bg-brand-50">
              ← Tour {selectedRound - 1}
            </Link>
          ) : (
            <span />
          )}
          <form method="get" action={base} className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
            <label htmlFor="tour" className="sr-only">
              Aller au tour
            </label>
            <select id="tour" name="tour" defaultValue={selectedRound} className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 sm:flex-none">
              {rounds.map((r) => (
                <option key={r.round} value={r.round}>
                  Tour {r.round}
                  {r.payout?.status === "paid" ? " ✓" : ""}
                </option>
              ))}
            </select>
            <button type="submit" className="min-h-12 rounded-xl border border-brand-700 px-3 font-semibold text-brand-700">
              Voir
            </button>
          </form>
          {selectedRound < rounds.length ? (
            <Link href={roundLink(selectedRound + 1)} className="inline-flex min-h-12 items-center rounded-xl px-3 font-semibold text-brand-700 hover:bg-brand-50">
              Tour {selectedRound + 1} →
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <div className="mt-4 rounded-2xl bg-brand-50 p-4">
          <h2 className="text-lg font-bold text-brand-900">
            Tour {round.round} · {formatDate(round.dueDate)}
          </h2>
          <p className="mt-1">
            Bénéficiaire : <strong>{beneficiary?.fullName ?? "—"}</strong>
            {round.payout && (
              <>
                {" "}— reçoit <strong className="text-brand-700">{formatMoney(round.payout.amount)}</strong>
                {round.payout.pot && <span className="text-sm text-muted"> (cagnotte {formatMoney(round.payout.pot)} moins la part du maman likelemba)</span>}
              </>
            )}
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={members.length} aria-valuenow={paidCount} aria-label="Cotisations reçues pour ce tour">
            <div className="h-full bg-brand-600" style={{ width: `${(paidCount / Math.max(members.length, 1)) * 100}%` }} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {paidCount} sur {members.length} ont payé{allPaid ? " — cagnotte complète" : ` — il manque ${members.length - paidCount} cotisation(s)`}
          </p>
          <div className="mt-3">
            {round.payout?.status === "paid" ? (
              <p className="font-semibold text-brand-700">
                ✓ Cagnotte versée à {beneficiary?.fullName}
                {round.payout.paidAt && ` le ${formatDateTime(round.payout.paidAt)}`} (simulation)
              </p>
            ) : round.payout && active && canRecord && allPaid ? (
              <PayoutButton
                groupId={group.id}
                payoutId={round.payout.id}
                round={round.round}
                label={`Verser ${formatMoney(round.payout.amount)} à ${beneficiary?.fullName ?? "le bénéficiaire"} (simulation)`}
              />
            ) : round.payout?.status === "cancelled" ? (
              <p className="text-sm text-muted">Versement annulé avec le cycle.</p>
            ) : (
              <p className="text-sm text-muted">Le versement sera possible quand tout le monde aura payé ce tour.</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-ink">Qui a payé ce tour ?</h3>
          <div className="flex gap-1 text-sm" role="group" aria-label="Filtrer">
            {[
              ["tous", "Tous"],
              ["attente", "Pas encore"],
              ["paye", "Ont payé"],
            ].map(([f, label]) => (
              <Link
                key={f}
                href={filterLink(f)}
                aria-current={filter === f ? "true" : undefined}
                className={`inline-flex min-h-12 items-center rounded-xl px-3 font-semibold ${filter === f ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-50"}`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-2">
          {rows.length === 0 ? (
            <p className="py-4 text-sm text-muted">Personne dans cette liste.</p>
          ) : (
            <ContributionsForm
              key={`${round.scheduleId}-${filter}`}
              groupId={group.id}
              scheduleId={round.scheduleId}
              round={round.round}
              rows={rows}
              canRecord={canRecord && active}
            />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-brand-900">Bilan par membre</h2>
        <p className="mt-1 text-sm text-muted">Qui a déjà reçu la cagnotte, qui attend son tour, et qui est à jour de ses cotisations.</p>
        <ul className="mt-3 divide-y divide-line">
          {members.map((m) => {
            const received = m.payoutStatus === "paid";
            return (
              <li key={m.participantId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
                <div className="min-w-0">
                  <p className="font-semibold break-words text-ink">
                    <span className="text-brand-700">Tour {m.position}</span> · {m.fullName}
                  </p>
                  <p className="text-sm text-muted">
                    Cotisations payées : {m.paidCount} / {m.dueCount} dues à ce jour
                    {m.lateCount > 0 && <span className="font-semibold text-red-700"> · {m.lateCount} en retard</span>}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${received ? "bg-brand-100 text-brand-900" : "bg-gold-100 text-gold-600"}`}
                >
                  {received
                    ? `✓ A reçu${m.payoutPaidAt ? ` le ${formatDate(m.payoutPaidAt.slice(0, 10))}` : ""}`
                    : `Pas encore reçu${m.payoutDueDate ? ` · prévu le ${formatDate(m.payoutDueDate)}` : ""}`}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

export default async function CyclePage({ params, searchParams }: PageProps<"/groupes/[groupId]/cycle">) {
  const { groupId } = await params;
  if (!idSchema.safeParse(groupId).success) notFound();
  const user = await requireUser(`/groupes/${groupId}/cycle`);
  const group = await getGroupDetail(groupId, user.id);
  if (!group) notFound();
  const q = await searchParams;

  const cycle = await getCurrentCycle(group.id);
  const started = cycle && cycle.status !== "draft" && cycle.status !== "preparing";
  const requested = Number(q.tour);
  const view = started ? await getCycleView(cycle, Number.isInteger(requested) ? requested : undefined) : null;
  const isOwner = group.isOwner && !user.isSuspended;
  const canRecord = (group.myRole === "manager" || group.myRole === "treasurer") && !user.isSuspended;
  const canLaunch = isOwner && group.status === "active" && (!cycle || !started || cycle.status === "completed" || cycle.status === "cancelled");
  const activeMembers = group.members.filter((m) => m.status === "active");

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/groupes/${group.id}`} className="text-sm font-semibold text-brand-700 underline">
        ← {group.name}
      </Link>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">
            {started ? `Cycle n° ${cycle.number}` : "Nouveau cycle"}
          </h1>
          {started && (
            <p className="text-muted">
              {CYCLE_STATUS_LABELS[cycle.status]} · du {formatDate(cycle.startDate)}
              {cycle.plannedEndDate && ` au ${formatDate(cycle.plannedEndDate)}`}
            </p>
          )}
        </div>
        <SimulationBadge className="self-start sm:self-auto" />
      </div>

      <Notices q={q} />
      {view?.partial && <Alert tone="warning">Certaines informations n&apos;ont pas pu être chargées. Actualisez la page.</Alert>}
      {cycle?.status === "cancelled" && cycle.cancellationReason && (
        <Alert tone="warning">Cycle annulé : {cycle.cancellationReason}</Alert>
      )}

      {view && <Tracking group={group} view={view} canRecord={canRecord} q={q} />}

      {view && isOwner && (
        <Card>
          <h2 className="text-lg font-bold text-brand-900">Frais LIKELEMBA</h2>
          <p className="mt-1 text-sm text-muted">
            1 USD par tour versé, pris sur votre part de maman likelemba. Visible par vous seul.
          </p>
          {view.fees.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Aucun frais pour l&apos;instant : ils apparaissent à chaque versement.</p>
          ) : (
            <>
              <p className="mt-2 text-sm">
                Réglés : <strong>{formatMoney(serviceFeesForTurns(view.fees.filter((f) => f.status === "paid").length))}</strong> · à régler :{" "}
                <strong>{formatMoney(serviceFeesForTurns(view.fees.filter((f) => f.status === "due").length))}</strong>
              </p>
              <ul className="mt-2 divide-y divide-line">
                {view.fees.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {f.round ? `Tour ${f.round}` : "Ancien frais de cycle"} · {formatMoney(f.amount)} ·{" "}
                      <span className={f.status === "due" ? "font-semibold text-gold-600" : "text-muted"}>{FEE_STATUS_LABELS[f.status]}</span>
                    </span>
                    {f.status === "due" && <PayFeeButton groupId={group.id} feeId={f.id} />}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {view && isOwner && cycle?.status === "active" && (
        <Card>
          <h2 className="text-lg font-bold text-brand-900">Fin du cycle</h2>
          {view.rounds.every((r) => r.payout?.status === "paid") ? (
            <div className="mt-3">
              <CompleteCycleButton groupId={group.id} cycleId={cycle.id} />
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted">Le cycle pourra être terminé quand tout le monde aura reçu son tour.</p>
          )}
          <details className="mt-4">
            <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-red-700">Annuler le cycle…</summary>
            <p className="mb-3 text-sm text-muted">
              Les cotisations et versements déjà faits restent dans l&apos;historique. Les versements à venir sont annulés.
            </p>
            <CancelCycleForm groupId={group.id} cycleId={cycle.id} />
          </details>
        </Card>
      )}

      {canLaunch && (
        <Card>
          <h2 className="text-lg font-bold text-brand-900">{started ? "Lancer un nouveau cycle" : "Préparer le cycle"}</h2>
          {activeMembers.length < 2 ? (
            <Alert tone="warning">Ajoutez au moins un autre membre au groupe avant de lancer un cycle.</Alert>
          ) : (
            <div className="mt-3">
              <CycleSetupForm
                groupId={group.id}
                members={activeMembers.map((m) => ({ id: m.id, name: m.fullName }))}
                initialOrder={cycle && !started ? await getDraftOrder(cycle.id) : []}
                defaultStartDate={todayIso()}
                frequency={group.frequency}
                contribution={group.contribution}
                organizerCommission={group.organizerCommission}
              />
            </div>
          )}
        </Card>
      )}

      {!view && !canLaunch && (
        <Card>
          <p className="text-muted">Aucun cycle n&apos;a encore démarré dans ce groupe.</p>
        </Card>
      )}
    </div>
  );
}
