import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, ButtonLink, Card, SimulationBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getGroupDetail, getPendingInvitations, type GroupDetail } from "@/lib/data/groups";
import { formatDate } from "@/lib/dates";
import { computeTurnBreakdown, validateOrganizerCommission } from "@/lib/domain/fees";
import { CURRENCY_LABELS, formatMoney } from "@/lib/domain/money";
import { formatDrcPhone, whatsappLink } from "@/lib/domain/phone";
import { FREQUENCY_LABELS } from "@/lib/domain/schedule";
import { MEMBER_ROLE_LABELS, idSchema } from "@/lib/validation/group";
import { AddMemberForm, ArchiveGroupForm, InviteMemberPanel, RemoveMemberForm } from "./member-forms";

export const metadata: Metadata = { title: "Groupe" };

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

function whatsappMessage(group: GroupDetail, memberName: string) {
  return (
    `Bonjour ${memberName}, c'est ${group.ownerName}, maman likelemba du groupe « ${group.name} » sur LIKELEMBA. ` +
    `Cotisation : ${formatMoney(group.contribution)}, ${FREQUENCY_LABELS[group.frequency].toLowerCase()}.`
  );
}

function TurnSummary({ group }: { group: GroupDetail }) {
  const participants = Math.max(group.memberCount, 2);
  const invalid = validateOrganizerCommission({
    contribution: group.contribution,
    participants,
    organizerCommission: group.organizerCommission,
  });
  if (invalid) {
    return (
      <Alert tone="warning">
        {invalid} {group.isOwner && "Corrigez-la avant de lancer un cycle."}
      </Alert>
    );
  }
  const t = computeTurnBreakdown({
    contribution: group.contribution,
    participants,
    organizerCommission: group.organizerCommission,
  });
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted">
        Cagnotte ({participants} membres × {formatMoney(group.contribution)})
      </dt>
      <dd className="text-right font-semibold tabular-nums">{formatMoney(t.pot)}</dd>
      <dt className="font-semibold text-brand-900">Le bénéficiaire reçoit</dt>
      <dd className="text-right text-lg font-extrabold text-brand-700 tabular-nums">{formatMoney(t.beneficiaryAmount)}</dd>
      <dt className="text-muted">Part du maman likelemba</dt>
      <dd className="text-right font-semibold tabular-nums">{formatMoney(t.organizerCommission)}</dd>
      {group.isOwner && (
        <>
          <dt className="text-muted">dont frais LIKELEMBA</dt>
          <dd className="text-right font-semibold tabular-nums">{formatMoney(t.likelembaFee)}</dd>
        </>
      )}
    </dl>
  );
}

export default async function GroupPage({ params, searchParams }: PageProps<"/groupes/[groupId]">) {
  const { groupId } = await params;
  if (!idSchema.safeParse(groupId).success) notFound();
  const user = await requireUser(`/groupes/${groupId}`);
  const group = await getGroupDetail(groupId, user.id);
  if (!group) notFound();
  const query = await searchParams;

  const canManage = group.isOwner && group.status === "active" && !user.isSuspended;
  const active = group.members.filter((m) => m.status !== "removed");
  const removed = group.members.filter((m) => m.status === "removed");
  const full = active.length >= group.maxMembers;
  const invitations = canManage ? await getPendingInvitations(group.id) : new Map();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/groupes" className="text-sm font-semibold text-brand-700 underline">
        ← Mes groupes
      </Link>

      {query.cree === "1" && (
        <Alert tone="success" title="Groupe créé">
          Ajoutez maintenant vos membres, puis contactez-les sur WhatsApp pour les prévenir.
        </Alert>
      )}
      {query.modifie === "1" && <Alert tone="success">Modifications enregistrées.</Alert>}
      {query.bienvenue === "1" && (
        <Alert tone="success" title="Bienvenue dans le groupe">
          Votre compte est maintenant rattaché à ce likelemba. Vous pouvez suivre le calendrier, les cotisations et
          les versements.
        </Alert>
      )}
      {query.membre === "1" && <Alert tone="success">Membre modifié.</Alert>}
      {query.archive === "1" && (
        <Alert tone="success">Groupe archivé. Il ne peut plus être modifié ; son historique reste consultable.</Alert>
      )}
      {query.retire === "1" && (
        <Alert tone="success">Membre retiré. Sa fiche et son historique sont conservés (voir « Membres retirés »).</Alert>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold break-words text-brand-900 sm:text-3xl">{group.name}</h1>
            {group.isDemo && (
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-bold text-gold-600">Démonstration</span>
            )}
            {group.status === "archived" && (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-muted">Archivé</span>
            )}
          </div>
          <p className="text-muted">
            Maman likelemba : <span className="font-semibold text-ink">{group.ownerName}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <ButtonLink href={`/groupes/${group.id}/modifier`} variant="secondary">
              Modifier le groupe
            </ButtonLink>
          )}
          {group.isOwner && (
            <ButtonLink href={`/groupes/${group.id}/historique`} variant="ghost">
              Historique
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-brand-900">Paramètres</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Devise</dt>
            <dd className="font-semibold">{CURRENCY_LABELS[group.currency]}</dd>
            <dt className="text-muted">Cotisation</dt>
            <dd className="font-semibold">{formatMoney(group.contribution)} par membre et par tour</dd>
            <dt className="text-muted">Fréquence</dt>
            <dd className="font-semibold">{FREQUENCY_LABELS[group.frequency]}</dd>
            <dt className="text-muted">Membres</dt>
            <dd className="font-semibold">
              {active.length} / {group.maxMembers}
            </dd>
          </dl>
          {group.description && <p className="mt-4 text-sm whitespace-pre-line">{group.description}</p>}
          {group.rules && (
            <>
              <h3 className="mt-4 text-sm font-bold text-ink">Règles du groupe</h3>
              <p className="mt-1 text-sm whitespace-pre-line text-muted">{group.rules}</p>
            </>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-brand-900">Un tour avec les membres actuels</h2>
            <SimulationBadge />
          </div>
          <div className="mt-3">
            <TurnSummary group={group} />
          </div>
          <div className="mt-4 border-t border-line pt-4">
            {group.hasOpenCycle ? (
              <ButtonLink href={`/groupes/${group.id}/cycle`} className="w-full sm:w-auto">
                Suivre les paiements du cycle
              </ButtonLink>
            ) : canManage ? (
              <ButtonLink href={`/groupes/${group.id}/cycle`} className="w-full sm:w-auto">
                {group.hasCycles ? "Lancer un nouveau cycle" : "Lancer le premier cycle"}
              </ButtonLink>
            ) : group.hasCycles ? (
              <ButtonLink href={`/groupes/${group.id}/cycle`} variant="secondary" className="w-full sm:w-auto">
                Voir le dernier cycle
              </ButtonLink>
            ) : (
              <p className="text-sm text-muted">Aucun cycle n&apos;a encore démarré.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-bold text-brand-900">
          Membres <span className="font-normal text-muted">({active.length})</span>
        </h2>
        <ul className="mt-3 divide-y divide-line">
          {active.map((m) => {
            const wa = m.phone ? whatsappLink(m.phone, whatsappMessage(group, m.fullName)) : null;
            const isMe = m.isMe;
            return (
              <li key={m.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold break-words text-ink">
                    {m.fullName} {isMe && <span className="font-normal text-muted">(vous)</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {MEMBER_ROLE_LABELS[m.role]}
                    {m.phone && ` · ${formatDrcPhone(m.phone)}`}
                    {!m.hasAccount && " · sans compte LIKELEMBA"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {wa && !isMe && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1f7a43] px-4 text-sm font-semibold text-white hover:bg-[#17633a]"
                    >
                      <WhatsAppIcon />
                      WhatsApp
                    </a>
                  )}
                  {canManage && (
                    <ButtonLink
                      href={`/groupes/${group.id}/membres/${m.id}`}
                      variant="ghost"
                      className="text-sm"
                      aria-label={`Modifier ${m.fullName}`}
                    >
                      Modifier
                    </ButtonLink>
                  )}
                  {canManage && m.role !== "manager" && (
                    <RemoveMemberForm groupId={group.id} memberId={m.id} name={m.fullName} />
                  )}
                  {canManage && m.role !== "manager" && !m.hasAccount && (
                    <InviteMemberPanel
                      memberId={m.id}
                      memberName={m.fullName}
                      phone={m.phone}
                      groupName={group.name}
                      groupId={group.id}
                      pending={
                        invitations.has(m.id)
                          ? {
                              invitationId: invitations.get(m.id)!.invitationId,
                              expiresLabel: formatDate(invitations.get(m.id)!.expiresAt.slice(0, 10)),
                            }
                          : null
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {canManage && (
        <Card>
          <h2 className="text-lg font-bold text-brand-900">Ajouter un membre</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Ajoutez les personnes que vous avez contactées (WhatsApp, Facebook, en personne). Elles n&apos;ont pas
            besoin d&apos;un compte LIKELEMBA pour l&apos;instant.
          </p>
          {full ? (
            <Alert tone="warning">
              Le groupe est complet ({group.maxMembers} membres). Augmentez le nombre maximal dans « Modifier le
              groupe ».
            </Alert>
          ) : (
            <AddMemberForm groupId={group.id} />
          )}
        </Card>
      )}

      {removed.length > 0 && (
        <Card>
          <h2 className="text-lg font-bold text-brand-900">Membres retirés</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {removed.map((m) => (
              <li key={m.id} className="py-2">
                <span className="font-semibold">{m.fullName}</span>
                <span className="text-muted">
                  {m.removedAt && ` · retiré(e) le ${formatDate(m.removedAt)}`}
                  {m.removalReason && ` · ${m.removalReason}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canManage && !group.hasOpenCycle && (
        <Card>
          <h2 className="text-lg font-bold text-brand-900">Archiver le groupe</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Pour un groupe qui ne fonctionne plus. Rien n&apos;est supprimé.</p>
          <ArchiveGroupForm groupId={group.id} />
        </Card>
      )}
    </div>
  );
}
