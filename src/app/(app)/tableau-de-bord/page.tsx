import type { Metadata } from "next";
import { Alert, ButtonLink, Card, SimulationBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { describeActivity } from "@/lib/data/activity";
import { getDashboardData, getWatchlist } from "@/lib/data/dashboard";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/domain/money";

export const metadata: Metadata = { title: "Tableau de bord" };

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-brand-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: PageProps<"/tableau-de-bord">) {
  const user = await requireUser();
  const params = await searchParams;
  const [data, watch] = await Promise.all([getDashboardData(user.id), getWatchlist()]);
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900 sm:text-3xl">
            {firstName ? `Bonjour ${firstName}` : "Bonjour"} 👋
          </h1>
          <p className="text-muted">Voici la situation de vos groupes.</p>
        </div>
        <SimulationBadge className="self-start sm:self-auto" />
      </div>

      {params["mot-de-passe"] === "modifie" && <Alert tone="success">Votre mot de passe a été modifié.</Alert>}
      {!data && <Alert tone="warning">La base de données n&apos;est pas encore configurée.</Alert>}
      {data?.partial && (
        <Alert tone="warning">
          Certaines informations n&apos;ont pas pu être chargées. Vérifiez votre connexion internet puis
          actualisez la page.
        </Alert>
      )}

      {data && (
        <>
          <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Groupes gérés" value={data.managedGroups} />
            <Stat label="Membres (mes groupes)" value={data.totalMembers} />
            <Stat label="Groupes actifs" value={data.activeGroups} hint={`sur ${data.visibleGroups} visibles`} />
            <Stat label="Cycles en cours" value={data.activeCycles} />
            <Stat label="Cotisations enregistrées" value={data.confirmedContributions} hint="simulées" />
            <Stat label="Versements en attente" value={data.pendingPayouts} hint="simulés" />
          </section>

          {watch.length > 0 && (
            <Card>
              <h2 className="text-lg font-bold text-brand-900">À surveiller</h2>
              <ul className="mt-3 divide-y divide-line">
                {watch.map((w) => (
                  <li key={`${w.groupId}-${w.cycleNumber}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold break-words text-ink">
                        {w.groupName} <span className="font-normal text-muted">· cycle n° {w.cycleNumber}</span>
                      </p>
                      <p className="text-sm text-muted">
                        {w.nextBeneficiary
                          ? `Prochain bénéficiaire : ${w.nextBeneficiary.name}, le ${formatDate(w.nextBeneficiary.dueDate)}`
                          : "Tous les tours ont été versés"}
                      </p>
                      {w.lateMembers > 0 && (
                        <p className="text-sm font-semibold text-red-700">
                          ⚠ {w.lateMembers} membre{w.lateMembers > 1 ? "s" : ""} en retard sur {w.participants}
                        </p>
                      )}
                    </div>
                    <ButtonLink href={`/groupes/${w.groupId}/cycle`} variant="secondary" className="text-sm">
                      Suivre
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.visibleGroups === 0 && (
            <Card className="border-dashed">
              <h2 className="text-lg font-bold text-brand-900">Vous n&apos;avez pas encore de groupe</h2>
              <p className="mt-2 text-muted">
                Créez votre likelemba, fixez la cotisation et votre part de maman likelemba, puis ajoutez vos
                membres. Le suivi des cycles arrivera dans la prochaine version.
              </p>
              {!user.isSuspended && (
                <ButtonLink href="/groupes/nouveau" className="mt-4">
                  Créer un groupe
                </ButtonLink>
              )}
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="text-lg font-bold text-brand-900">Prochaines échéances</h2>
              {data.upcoming.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Aucune échéance à venir.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {data.upcoming.map((due) => (
                    <li key={due.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold text-ink">{due.groupName}</p>
                        <p className="text-sm text-muted">
                          Tour {due.round} — {formatDate(due.dueDate)}
                        </p>
                      </div>
                      <p className="text-right font-semibold whitespace-nowrap text-brand-700">
                        {formatMoney(due.amountPerMember)}
                        <span className="block text-xs font-normal text-muted">par membre</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-brand-900">Dernières activités</h2>
              {data.activity.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Aucune activité récente.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {data.activity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="text-ink">{describeActivity(a.entityType, a.action)}</span>
                      <time dateTime={a.createdAt} className="whitespace-nowrap text-muted">
                        {formatDateTime(a.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
