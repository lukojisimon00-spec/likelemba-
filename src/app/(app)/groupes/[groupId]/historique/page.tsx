import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, ButtonLink, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getGroupDetail } from "@/lib/data/groups";
import { formatDateTime } from "@/lib/dates";
import { describeAuditEntry, type HistoryLine } from "@/lib/domain/history";
import { idSchema } from "@/lib/validation/group";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Historique du groupe" };

const PAGE_SIZE = 50;
const KIND_LABEL: Record<HistoryLine["kind"], string> = {
  groupe: "Groupe",
  membre: "Membre",
  cycle: "Cycle",
  argent: "Argent",
  frais: "Frais",
  invitation: "Invitation",
  technique: "Détail",
};

export default async function HistoryPage({ params, searchParams }: PageProps<"/groupes/[groupId]/historique">) {
  const { groupId } = await params;
  if (!idSchema.safeParse(groupId).success) notFound();
  const user = await requireUser(`/groupes/${groupId}/historique`);
  const group = await getGroupDetail(groupId, user.id);
  if (!group) notFound();
  const q = await searchParams;
  const page = Math.max(1, Number.parseInt(String(q.page ?? "1"), 10) || 1);
  const showDetail = q.detail === "1";

  // RLS : seuls le responsable du groupe et l'administrateur lisent le journal.
  const supabase = await createClient();
  const { data, error } = supabase
    ? await supabase
        .from("audit_logs")
        .select("id, created_at, actor_id, entity_type, action, details")
        .eq("group_id", group.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : { data: null, error: null };

  type Row = { id: number; created_at: string; actor_id: string | null; entity_type: string; action: string; details: Record<string, unknown> };
  const rows = (data ?? []) as Row[];
  const hasMore = rows.length > PAGE_SIZE;
  // Nom de l'auteur : via les fiches de membres rattachées à un compte (pas de lecture des profils d'autrui).
  const actorName = new Map(group.members.filter((m) => m.profileId).map((m) => [m.profileId!, m.fullName]));
  const lines = rows.slice(0, PAGE_SIZE).map((r) => ({
    id: r.id,
    at: r.created_at,
    by: r.actor_id === user.id ? "Vous" : r.actor_id ? (actorName.get(r.actor_id) ?? "Autre compte") : "Système",
    ...describeAuditEntry({ entityType: r.entity_type, action: r.action, details: r.details }),
  }));
  const visible = showDetail ? lines : lines.filter((l) => l.kind !== "technique");
  const link = (p: number, detail = showDetail) =>
    `/groupes/${group.id}/historique?page=${p}${detail ? "&detail=1" : ""}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href={`/groupes/${group.id}`} className="text-sm font-semibold text-brand-700 underline">
        ← {group.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">Historique du groupe</h1>
        <p className="text-muted">Tout ce qui s&apos;est passé, du plus récent au plus ancien. Rien ne peut être effacé.</p>
      </div>

      {!group.isOwner && (
        <Alert tone="info">L&apos;historique détaillé est réservé au maman likelemba (responsable) du groupe.</Alert>
      )}
      {error && <Alert tone="warning">L&apos;historique n&apos;a pas pu être chargé. Actualisez la page.</Alert>}

      {group.isOwner && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">Page {page}</p>
            <ButtonLink href={link(1, !showDetail)} variant="ghost" className="text-sm">
              {showDetail ? "Masquer les détails techniques" : "Afficher les détails techniques"}
            </ButtonLink>
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-muted">Aucune opération à afficher.</p>
          ) : (
            <ol className="divide-y divide-line">
              {visible.map((l) => (
                <li key={l.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <span className="mr-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                      {KIND_LABEL[l.kind]}
                    </span>
                    <span className="break-words text-ink">{l.text}</span>
                  </div>
                  <p className="shrink-0 text-xs text-muted sm:text-right">
                    <time dateTime={l.at}>{formatDateTime(l.at)}</time>
                    <span className="block">{l.by}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-4 flex justify-between gap-2">
            {page > 1 ? (
              <ButtonLink href={link(page - 1)} variant="secondary" className="text-sm">
                ← Plus récent
              </ButtonLink>
            ) : (
              <span />
            )}
            {hasMore && (
              <ButtonLink href={link(page + 1)} variant="secondary" className="text-sm">
                Plus ancien →
              </ButtonLink>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
