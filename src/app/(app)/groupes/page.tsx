import type { Metadata } from "next";
import Link from "next/link";
import { Alert, ButtonLink, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listMyGroups } from "@/lib/data/groups";
import { formatMoney } from "@/lib/domain/money";
import { FREQUENCY_LABELS } from "@/lib/domain/schedule";

export const metadata: Metadata = { title: "Mes groupes" };

export default async function GroupsPage() {
  const user = await requireUser("/groupes");
  const result = await listMyGroups(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">Mes groupes</h1>
          <p className="text-muted">Les likelemba que vous gérez ou dont vous êtes membre.</p>
        </div>
        {!user.isSuspended && <ButtonLink href="/groupes/nouveau">Créer un groupe</ButtonLink>}
      </div>

      {!result && <Alert tone="warning">La base de données n&apos;est pas encore configurée.</Alert>}
      {result?.error && (
        <Alert tone="warning">
          Vos groupes n&apos;ont pas pu être chargés. Vérifiez votre connexion internet puis actualisez la page.
        </Alert>
      )}

      {result && !result.error && result.groups.length === 0 && (
        <Card className="border-dashed">
          <h2 className="text-lg font-bold text-brand-900">Aucun groupe pour le moment</h2>
          <p className="mt-2 text-muted">
            Créez votre premier likelemba : choisissez la devise, la cotisation et votre part de maman likelemba,
            puis ajoutez vos membres.
          </p>
        </Card>
      )}

      {result && result.groups.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groupes/${g.id}`}
                className="block rounded-2xl border border-line bg-white p-5 hover:border-brand-600"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold break-words text-brand-900">{g.name}</h2>
                  {g.isDemo && (
                    <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-bold text-gold-600">
                      Démonstration
                    </span>
                  )}
                  {g.status === "archived" && (
                    <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-muted">Archivé</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {g.isOwner ? "Vous êtes le maman likelemba" : "Vous êtes membre"} · {g.memberCount} membre
                  {g.memberCount > 1 ? "s" : ""}
                </p>
                <p className="mt-2 font-semibold text-brand-700">
                  {formatMoney(g.contribution)}{" "}
                  <span className="font-normal text-muted">· {FREQUENCY_LABELS[g.frequency].toLowerCase()}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
