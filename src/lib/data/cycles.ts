import "server-only";
import { todayIso } from "@/lib/dates";
import type { CycleStatus } from "@/lib/domain/cycle";
import { isCurrency, money, type Currency, type Money } from "@/lib/domain/money";
import type { Frequency } from "@/lib/domain/schedule";
import { createClient } from "@/lib/supabase/server";

export type CycleInfo = {
  id: string;
  number: number;
  status: CycleStatus;
  startDate: string;
  plannedEndDate: string | null;
  currency: Currency;
  contribution: Money;
  organizerCommission: Money;
  frequency: Frequency;
  cancellationReason: string | null;
};

export type Round = {
  scheduleId: string;
  round: number;
  dueDate: string;
  beneficiaryParticipantId: string;
  payout: {
    id: string;
    status: "pending" | "paid" | "failed" | "cancelled";
    amount: Money;
    pot: Money | null;
    paidAt: string | null;
  } | null;
};

export type MemberSummary = {
  participantId: string;
  memberId: string;
  fullName: string;
  phone: string | null;
  position: number;
  dueCount: number;
  paidCount: number;
  lateCount: number;
  payoutStatus: "pending" | "paid" | "failed" | "cancelled" | null;
  payoutPaidAt: string | null;
  payoutDueDate: string | null;
};

export type RoundContribution = {
  id: string;
  participantId: string;
  status: "pending" | "confirmed" | "failed" | "cancelled";
  receiptNumber: string | null;
  paidAt: string | null;
};

export type Fee = { id: string; round: number | null; amount: Money; status: "due" | "paid" | "waived" | "cancelled"; paidAt: string | null };

export type CycleView = {
  cycle: CycleInfo;
  rounds: Round[];
  members: MemberSummary[];
  /** Tour affiché (numéro). */
  selectedRound: number;
  /** Cotisations du tour affiché, par participant. */
  contributions: Record<string, RoundContribution>;
  /** Frais LIKELEMBA du cycle (visibles du responsable seulement, sinon liste vide). */
  fees: Fee[];
  today: string;
  partial: boolean;
};

type CycleRow = {
  id: string;
  cycle_number: number;
  status: CycleStatus;
  start_date: string;
  planned_end_date: string | null;
  currency: string;
  contribution_amount: string | number;
  organizer_commission: string | number;
  frequency: Frequency;
  cancellation_reason: string | null;
};

const OPEN: CycleStatus[] = ["draft", "preparing", "active"];

/** Cycle à afficher : le cycle ouvert s'il existe, sinon le plus récent. */
export async function getCurrentCycle(groupId: string): Promise<CycleInfo | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("cycles")
    .select(
      "id, cycle_number, status, start_date, planned_end_date, currency, contribution_amount, organizer_commission, frequency, cancellation_reason",
    )
    .eq("group_id", groupId)
    .order("cycle_number", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as CycleRow[];
  const row = rows.find((c) => OPEN.includes(c.status)) ?? rows[0];
  if (!row) return null;
  const currency: Currency = isCurrency(row.currency) ? row.currency : "USD";
  return {
    id: row.id,
    number: row.cycle_number,
    status: row.status,
    startDate: row.start_date,
    plannedEndDate: row.planned_end_date,
    currency,
    contribution: money(row.contribution_amount, currency),
    organizerCommission: money(row.organizer_commission, currency),
    frequency: row.frequency,
    cancellationReason: row.cancellation_reason,
  };
}

/** Ordre actuel d'un cycle en brouillon (identifiants de membres, tour 1 en premier). */
export async function getDraftOrder(cycleId: string): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("cycle_participants")
    .select("member_id, payout_position")
    .eq("cycle_id", cycleId)
    .order("payout_position");
  return ((data ?? []) as { member_id: string }[]).map((r) => r.member_id);
}

/** Toutes les données du suivi d'un cycle démarré (actif, terminé ou annulé). */
export async function getCycleView(cycle: CycleInfo, requestedRound?: number): Promise<CycleView | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const today = todayIso();
  const c = cycle.currency;

  const [schedules, payouts, summary, fees] = await Promise.all([
    supabase
      .from("contribution_schedules")
      .select("id, round_number, due_date, beneficiary_participant_id")
      .eq("cycle_id", cycle.id)
      .order("round_number"),
    supabase
      .from("payout_orders")
      .select("id, schedule_id, status, amount, gross_amount, paid_at")
      .eq("cycle_id", cycle.id),
    supabase.rpc("cycle_member_summary", { p_cycle_id: cycle.id, p_today: today }),
    supabase
      .from("service_fees")
      .select("id, amount, status, paid_at, payout_id, payout_orders(contribution_schedules(round_number))")
      .eq("cycle_id", cycle.id)
      .order("created_at"),
  ]);

  type PayoutRow = { id: string; schedule_id: string; status: NonNullable<Round["payout"]>["status"]; amount: string; gross_amount: string | null; paid_at: string | null };
  const payoutBySchedule = new Map(((payouts.data ?? []) as PayoutRow[]).map((p) => [p.schedule_id, p]));

  type ScheduleRow = { id: string; round_number: number; due_date: string; beneficiary_participant_id: string };
  const rounds: Round[] = ((schedules.data ?? []) as ScheduleRow[]).map((s) => {
    const p = payoutBySchedule.get(s.id);
    return {
      scheduleId: s.id,
      round: s.round_number,
      dueDate: s.due_date,
      beneficiaryParticipantId: s.beneficiary_participant_id,
      payout: p
        ? {
            id: p.id,
            status: p.status,
            amount: money(p.amount, c),
            pot: p.gross_amount === null ? null : money(p.gross_amount, c),
            paidAt: p.paid_at,
          }
        : null,
    };
  });

  // Tour affiché : celui demandé, sinon le premier tour pas encore versé, sinon le dernier.
  const firstOpen = rounds.find((r) => r.payout?.status !== "paid");
  const selectedRound =
    requestedRound && rounds.some((r) => r.round === requestedRound)
      ? requestedRound
      : (firstOpen?.round ?? rounds.at(-1)?.round ?? 1);
  const selected = rounds.find((r) => r.round === selectedRound);

  const contributions: Record<string, RoundContribution> = {};
  let contribError = false;
  if (selected) {
    const { data, error } = await supabase
      .from("contributions")
      .select("id, participant_id, status, receipt_number, paid_at")
      .eq("schedule_id", selected.scheduleId)
      .in("status", ["confirmed", "pending"]);
    contribError = Boolean(error);
    for (const row of (data ?? []) as {
      id: string;
      participant_id: string;
      status: RoundContribution["status"];
      receipt_number: string | null;
      paid_at: string | null;
    }[]) {
      contributions[row.participant_id] = {
        id: row.id,
        participantId: row.participant_id,
        status: row.status,
        receiptNumber: row.receipt_number,
        paidAt: row.paid_at,
      };
    }
  }

  type SummaryRow = {
    participant_id: string;
    member_id: string;
    full_name: string;
    phone: string | null;
    payout_position: number;
    due_count: number;
    paid_count: number;
    late_count: number;
    payout_status: MemberSummary["payoutStatus"];
    payout_paid_at: string | null;
    payout_due_date: string | null;
  };
  const members: MemberSummary[] = ((summary.data ?? []) as SummaryRow[]).map((m) => ({
    participantId: m.participant_id,
    memberId: m.member_id,
    fullName: m.full_name,
    phone: m.phone,
    position: m.payout_position,
    dueCount: m.due_count,
    paidCount: m.paid_count,
    lateCount: m.late_count,
    payoutStatus: m.payout_status,
    payoutPaidAt: m.payout_paid_at,
    payoutDueDate: m.payout_due_date,
  }));

  type FeeRow = {
    id: string;
    amount: string;
    status: Fee["status"];
    paid_at: string | null;
    payout_orders: { contribution_schedules: { round_number: number } | null } | null;
  };
  const feeList: Fee[] = ((fees.data ?? []) as unknown as FeeRow[]).map((f) => ({
    id: f.id,
    round: f.payout_orders?.contribution_schedules?.round_number ?? null,
    amount: money(f.amount, "USD"),
    status: f.status,
    paidAt: f.paid_at,
  }));

  return {
    cycle,
    rounds,
    members,
    selectedRound,
    contributions,
    fees: feeList,
    today,
    partial: Boolean(schedules.error || payouts.error || summary.error || fees.error || contribError),
  };
}
