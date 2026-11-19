import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getGroupDetail } from "@/lib/data/groups";
import { formatDrcPhone } from "@/lib/domain/phone";
import { idSchema } from "@/lib/validation/group";
import { EditMemberForm } from "./edit-member-form";

export const metadata: Metadata = { title: "Modifier un membre" };

export default async function EditMemberPage({ params }: PageProps<"/groupes/[groupId]/membres/[memberId]">) {
  const { groupId, memberId } = await params;
  if (!idSchema.safeParse(groupId).success || !idSchema.safeParse(memberId).success) notFound();
  const user = await requireUser(`/groupes/${groupId}/membres/${memberId}`);
  const group = await getGroupDetail(groupId, user.id);
  const member = group?.members.find((m) => m.id === memberId);
  if (!group || !member) notFound();
  const canManage = group.isOwner && group.status === "active" && !user.isSuspended && member.status !== "removed";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href={`/groupes/${group.id}`} className="text-sm font-semibold text-brand-700 underline">
        ← {group.name}
      </Link>
      <h1 className="text-2xl font-bold break-words text-brand-900 sm:text-3xl">Modifier : {member.fullName}</h1>
      {!canManage ? (
        <Alert tone="error">
          {member.status === "removed"
            ? "Ce membre a été retiré : sa fiche est conservée telle quelle pour l'historique."
            : "Seul le maman likelemba (responsable) peut modifier les membres de ce groupe."}
        </Alert>
      ) : (
        <Card>
          <EditMemberForm
            groupId={group.id}
            memberId={member.id}
            isManager={member.role === "manager"}
            defaults={{
              fullName: member.fullName,
              phone: member.phone ? formatDrcPhone(member.phone) : "",
              role: member.role === "treasurer" ? "treasurer" : "member",
            }}
          />
          <p className="mt-4 text-xs text-muted">Chaque modification est enregistrée dans l&apos;historique du groupe.</p>
        </Card>
      )}
    </div>
  );
}
