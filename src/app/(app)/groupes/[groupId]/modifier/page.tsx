import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getGroupDetail } from "@/lib/data/groups";
import { toDecimalString } from "@/lib/domain/money";
import { idSchema } from "@/lib/validation/group";
import { updateGroupAction } from "../../actions";
import { GroupForm } from "../../group-form";

export const metadata: Metadata = { title: "Modifier le groupe" };

/** « 10.00 » → « 10 », « 10.50 » → « 10,50 » pour la saisie. */
function editable(decimal: string) {
  return decimal.replace(/\.00$/, "").replace(".", ",");
}

export default async function EditGroupPage({ params }: PageProps<"/groupes/[groupId]/modifier">) {
  const { groupId } = await params;
  if (!idSchema.safeParse(groupId).success) notFound();
  const user = await requireUser(`/groupes/${groupId}/modifier`);
  const group = await getGroupDetail(groupId, user.id);
  if (!group) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href={`/groupes/${group.id}`} className="text-sm font-semibold text-brand-700 underline">
        ← {group.name}
      </Link>
      <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">Modifier le groupe</h1>
      {!group.isOwner || group.status === "archived" || user.isSuspended ? (
        <Alert tone="error">
          {group.status === "archived"
            ? "Ce groupe est archivé : il ne peut plus être modifié."
            : "Seul le maman likelemba (responsable) de ce groupe peut le modifier."}
        </Alert>
      ) : (
        <Card>
          {group.hasOpenCycle && (
            <div className="mb-5">
              <Alert tone="info">
                Un cycle est en cours : les nouveaux montants s&apos;appliqueront seulement au prochain cycle.
              </Alert>
            </div>
          )}
          <GroupForm
            action={updateGroupAction}
            groupId={group.id}
            currencyLocked={group.hasCycles}
            submitLabel="Enregistrer les modifications"
            defaults={{
              name: group.name,
              description: group.description,
              currency: group.currency,
              contributionAmount: editable(toDecimalString(group.contribution)),
              organizerCommission: editable(toDecimalString(group.organizerCommission)),
              frequency: group.frequency,
              maxMembers: String(group.maxMembers),
              rules: group.rules,
            }}
          />
        </Card>
      )}
    </div>
  );
}
