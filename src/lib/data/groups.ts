import "server-only";
import { isCurrency, money, type Currency, type Money } from "@/lib/domain/money";
import type { Frequency } from "@/lib/domain/schedule";
import { createClient } from "@/lib/supabase/server";

export type MemberRole = "manager" | "treasurer" | "member";
export type GroupRole = MemberRole;

export type GroupSummary = {
  id: string;
  name: string;
  currency: Currency;
  contribution: Money;
  frequency: Frequency;
  status: "active" | "archived";
  isDemo: boolean;
  isOwner: boolean;
  memberCount: number;
};

export type GroupMember = {
  id: string;
  fullName: string;
  phone: string | null;
  role: MemberRole;
  status: "invited" | "active" | "removed";
  hasAccount: boolean;
  /** Fiche rattachée au compte de l'utilisateur connecté. */
  isMe: boolean;
  joinedAt: string;
  removedAt: string | null;
  removalReason: string | null;
};

export type GroupDetail = GroupSummary & {
  description: string;
  rules: string;
  organizerCommission: Money;
  maxMembers: number;
  ownerName: string;
  hasCycles: boolean;
  hasOpenCycle: boolean;
  /** Rôle de l'utilisateur connecté dans ce groupe (null : administrateur non membre). */
  myRole: GroupRole | null;
  members: GroupMember[];
};

type GroupRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  currency: string;
  contribution_amount: string | number;
  organizer_commission: string | number;
  frequency: Frequency;
  max_members: number;
  rules: string;
  status: "active" | "archived";
  is_demo: boolean;
};

const GROUP_COLUMNS =
  "id, owner_id, name, description, currency, contribution_amount, organizer_commission, frequency, max_members, rules, status, is_demo";

function currencyOf(row: GroupRow): Currency {
  return isCurrency(row.currency) ? row.currency : "USD";
}

/** Groupes visibles par l'utilisateur (RLS : ceux dont il est membre). */
export async function listMyGroups(userId: string): Promise<{ groups: GroupSummary[]; error: boolean } | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("groups")
    .select(`${GROUP_COLUMNS}, group_members(count)`)
    .neq("group_members.status", "removed")
    .order("status")
    .order("created_at", { ascending: false });

  type Row = GroupRow & { group_members: { count: number }[] };
  const groups = ((data ?? []) as unknown as Row[]).map((row) => {
    const currency = currencyOf(row);
    return {
      id: row.id,
      name: row.name,
      currency,
      contribution: money(row.contribution_amount, currency),
      frequency: row.frequency,
      status: row.status,
      isDemo: row.is_demo,
      isOwner: row.owner_id === userId,
      memberCount: row.group_members?.[0]?.count ?? 0,
    };
  });
  return { groups, error: Boolean(error) };
}

/** Détail d'un groupe et de ses membres. null si introuvable ou non autorisé (RLS). */
export async function getGroupDetail(groupId: string, userId: string): Promise<GroupDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: group } = await supabase.from("groups").select(GROUP_COLUMNS).eq("id", groupId).maybeSingle();
  if (!group) return null;
  const row = group as GroupRow;

  const [{ data: members }, { data: cycles }] = await Promise.all([
    supabase
      .from("group_members")
      .select("id, profile_id, full_name, phone, role, status, joined_at, removed_at, removal_reason")
      .eq("group_id", groupId)
      .order("status")
      .order("created_at"),
    supabase.from("cycles").select("status").eq("group_id", groupId),
  ]);

  type MemberRow = {
    id: string;
    profile_id: string | null;
    full_name: string;
    phone: string | null;
    role: MemberRole;
    status: GroupMember["status"];
    joined_at: string;
    removed_at: string | null;
    removal_reason: string | null;
  };
  const memberRows = (members ?? []) as MemberRow[];
  const roleOrder: Record<MemberRole, number> = { manager: 0, treasurer: 1, member: 2 };
  const list: GroupMember[] = memberRows
    .map((m) => ({
      id: m.id,
      fullName: m.full_name,
      phone: m.phone,
      role: m.role,
      status: m.status,
      hasAccount: m.profile_id !== null,
      isMe: m.profile_id === userId,
      joinedAt: m.joined_at,
      removedAt: m.removed_at,
      removalReason: m.removal_reason,
    }))
    .sort(
      (a, b) =>
        Number(a.status === "removed") - Number(b.status === "removed") || roleOrder[a.role] - roleOrder[b.role],
    );

  const me = memberRows.find((m) => m.profile_id === userId && m.status === "active");
  const currency = currencyOf(row);
  const cycleStatuses = ((cycles ?? []) as { status: string }[]).map((c) => c.status);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rules: row.rules,
    currency,
    contribution: money(row.contribution_amount, currency),
    organizerCommission: money(row.organizer_commission, currency),
    frequency: row.frequency,
    maxMembers: row.max_members,
    status: row.status,
    isDemo: row.is_demo,
    isOwner: row.owner_id === userId,
    ownerName: memberRows.find((m) => m.role === "manager")?.full_name ?? "Responsable",
    memberCount: list.filter((m) => m.status !== "removed").length,
    hasCycles: cycleStatuses.length > 0,
    hasOpenCycle: cycleStatuses.some((s) => s === "draft" || s === "preparing" || s === "active"),
    myRole: row.owner_id === userId ? "manager" : (me?.role ?? null),
    members: list,
  };
}
