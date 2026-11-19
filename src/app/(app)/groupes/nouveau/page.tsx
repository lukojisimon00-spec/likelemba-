import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createGroupAction } from "../actions";
import { GroupForm } from "../group-form";

export const metadata: Metadata = { title: "Créer un groupe" };

export default async function NewGroupPage() {
  const user = await requireUser("/groupes/nouveau");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/groupes" className="text-sm font-semibold text-brand-700 underline">
        ← Mes groupes
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">Créer un groupe</h1>
        <p className="text-muted">Vous serez le maman likelemba (responsable) de ce groupe.</p>
      </div>
      {user.isSuspended ? (
        <Alert tone="error">Votre compte est suspendu : vous ne pouvez pas créer de groupe.</Alert>
      ) : (
        <Card>
          <GroupForm action={createGroupAction} submitLabel="Créer le groupe" />
        </Card>
      )}
    </div>
  );
}
