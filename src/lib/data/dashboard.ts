import "server-only";
import { isCurrency, money, type Money } from "@/lib/domain/money";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export type UpcomingDue = {
  id: string;
  groupName: string;
  round: number;
  dueDate: string;
  amountPerMember: Money;
};

export type RecentActivity = { id: number; createdAt: string; entityType: string; action: string };

export type DashboardData = {
  managedGroups: number;
  visibleGroups: number;
  activeGroups: number;
  totalMembers: number;
  activeCycles: number;
  confirmedContributions: number;
  pendingPayouts: number;
  upcoming: UpcomingDue[];
  activity: RecentActivity[];
  /** true si au moins une requête a échoué (réseau, etc.). */
  partial: boolean;
};

/**
 * Indicateurs du tableau de bord. Toutes les requêtes passent par RLS :
 * l'utilisateur ne compte que ce qu'il a le droit de voir.
 */
export async function getDashboardData(userId: string): Promise<DashboardData | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const today = todayIso();

  const { data: managed, error: managedError } = await supabase
    .from("groups")
    .select("id")
    .eq("owner_id", userId);
  const managedIds = (managed ?? []).map((g: { id: string }) => g.id);

  const count = { count: "exact" as const, head: true };
  const [visible, active, members, cycles, contributions, payouts, upcoming, activity] = await Promise.all([
    supabase.from("groups").select("id", count),
    supabase.from("groups").select("id", count).eq("status", "active"),
    managedIds.length
      ? supabase.from("group_members").select("id", count).in("group_id", managedIds).neq("status", "removed")
      : Promise.resolve({ count: 0, error: null }),
    supabase.from("cycles").select("id", count).eq("status", "active"),
    supabase.from("contributions").select("id", count).eq("status", "confirmed"),
    supabase.from("payout_orders").select("id", count).eq("status", "pending"),
    supabase
      .from("contribution_schedules")
      .select("id, round_number, due_date, amount_per_member, currency, cycles!inner(status, groups(name))")
      .eq("cycles.status", "active")
      .gte("due_date", today)
      .order("due_date")
      .limit(5),
    supabase.from("audit_logs").select("id, created_at, entity_type, action").order("created_at", { ascending: false }).limit(6),
  ]);

  const results = [visible, active, members, cycles, contributions, payouts, upcoming, activity];
  const partial = Boolean(managedError) || results.some((r) => r.error);

  type UpcomingRow = {
    id: string;
    round_number: number;
    due_date: string;
    amount_per_member: string | number;
    currency: string;
    cycles: { groups: { name: string } | null } | null;
  };

  return {
    managedGroups: managedIds.length,
    visibleGroups: visible.count ?? 0,
    activeGroups: active.count ?? 0,
    totalMembers: members.count ?? 0,
    activeCycles: cycles.count ?? 0,
    confirmedContributions: contributions.count ?? 0,
    pendingPayouts: payouts.count ?? 0,
    upcoming: ((upcoming.data ?? []) as unknown as UpcomingRow[])
      .filter((row) => isCurrency(row.currency))
      .map((row) => ({
        id: row.id,
        groupName: row.cycles?.groups?.name ?? "Groupe",
        round: row.round_number,
        dueDate: row.due_date,
        amountPerMember: money(row.amount_per_member, row.currency as "USD" | "CDF"),
      })),
    activity: (activity.data ?? []).map(
      (row: { id: number; created_at: string; entity_type: string; action: string }) => ({
        id: row.id,
        createdAt: row.created_at,
        entityType: row.entity_type,
        action: row.action,
      }),
    ),
    partial,
  };
}
