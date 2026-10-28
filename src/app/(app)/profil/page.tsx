import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDrcPhone } from "@/lib/domain/phone";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const user = await requireUser("/profil");
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">Mon profil</h1>
      <Card>
        <dl className="mb-6 grid gap-1 text-sm">
          <dt className="text-muted">Adresse e-mail</dt>
          <dd className="font-semibold text-ink">{user.email ?? "—"}</dd>
          <dt className="mt-3 text-muted">Rôle sur la plateforme</dt>
          <dd className="font-semibold text-ink">{user.isAdmin ? "Administrateur" : "Utilisateur"}</dd>
        </dl>
        <ProfileForm fullName={user.fullName} phone={user.phone ? formatDrcPhone(user.phone) : ""} />
      </Card>
      <Card>
        <h2 className="font-bold text-ink">Mot de passe</h2>
        <p className="mt-1 text-sm text-muted">
          Pour changer de mot de passe, demandez un lien de réinitialisation par e-mail.
        </p>
        <Link href="/mot-de-passe-oublie" className="mt-3 inline-block font-semibold text-brand-700 underline">
          Changer mon mot de passe
        </Link>
      </Card>
    </div>
  );
}
