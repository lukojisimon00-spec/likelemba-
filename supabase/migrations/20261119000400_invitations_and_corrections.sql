-- =============================================================================
-- LIKELEMBA — Migration 7 : invitations par lien et correction traçable d'une cotisation
-- -----------------------------------------------------------------------------
-- Ajouts uniquement (aucune donnée ni règle existante n'est modifiée).
--
-- 1. Invitations : le maman likelemba crée un lien personnel pour un membre déjà
--    ajouté (nom + téléphone). La personne ouvre le lien, se connecte ou crée son
--    compte, et sa fiche de membre est rattachée à son compte : elle voit alors
--    son groupe (et seulement lui).
--    * Le lien contient un jeton aléatoire de 32 octets ; seule son empreinte
--      SHA-256 est stockée. Lien à usage unique, valable 14 jours, révocable.
--    * Créer un nouveau lien pour un membre révoque les précédents.
-- 2. Correction d'une cotisation enregistrée par erreur : annulation avec motif
--    obligatoire, uniquement tant que la cagnotte du tour n'a pas été versée.
--    Rien n'est effacé : l'opération reste visible (statut « annulée ») et le
--    journal d'audit garde l'ancienne valeur.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Invitations
-- -----------------------------------------------------------------------------
create table public.group_invitations (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete restrict,
  member_id   uuid not null references public.group_members (id) on delete restrict,
  token_hash  text not null unique check (char_length(token_hash) = 64),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at  timestamptz,
  constraint group_invitations_accept_consistency check ((accepted_at is null) = (accepted_by is null)),
  constraint group_invitations_not_both check (accepted_at is null or revoked_at is null)
);

comment on table public.group_invitations is
  'Liens d''invitation personnels (un par fiche de membre). Seule l''empreinte du jeton est stockée.';

create index group_invitations_group_id_idx on public.group_invitations (group_id);
create index group_invitations_member_id_idx on public.group_invitations (member_id);

create trigger audit_group_invitations after insert or update on public.group_invitations
  for each row execute function private.audit_row('token_hash');

alter table public.group_invitations enable row level security;
revoke all on public.group_invitations from anon, authenticated;
grant select (id, group_id, member_id, created_by, created_at, expires_at, accepted_at, accepted_by, revoked_at)
  on public.group_invitations to authenticated;
-- Aucune écriture directe : tout passe par les fonctions ci-dessous.
create policy group_invitations_select on public.group_invitations
  for select to authenticated
  using (private.is_group_manager(group_id) or (select private.is_platform_admin()));

create or replace function private.sha256_hex(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_text, 'UTF8'), 'sha256'), 'hex');
$$;

-- Crée un lien pour un membre sans compte. Renvoie le jeton en clair (une seule fois).
create or replace function public.create_member_invitation(p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.group_members;
  v_group  public.groups;
  v_token  text;
begin
  perform private.assert_active_user();
  select * into v_member from public.group_members where id = p_member_id;
  if v_member.id is null or not private.is_group_manager(v_member.group_id) then
    raise exception 'Membre introuvable ou accès refusé.' using errcode = '42501';
  end if;
  select * into v_group from public.groups where id = v_member.group_id;
  if v_group.status <> 'active' then
    raise exception 'Ce groupe est archivé : impossible d''inviter.';
  end if;
  if v_member.status <> 'active' then
    raise exception 'Seul un membre actif peut être invité.';
  end if;
  if v_member.profile_id is not null then
    raise exception 'Ce membre a déjà rattaché son compte LIKELEMBA.';
  end if;

  -- Un seul lien valable à la fois par membre.
  update public.group_invitations set revoked_at = now()
  where member_id = p_member_id and accepted_at is null and revoked_at is null;

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.group_invitations (group_id, member_id, token_hash, created_by)
  values (v_member.group_id, p_member_id, private.sha256_hex(v_token), auth.uid());
  return v_token;
end;
$$;

create or replace function public.revoke_member_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.group_invitations;
begin
  perform private.assert_active_user();
  select * into v_inv from public.group_invitations where id = p_invitation_id for update;
  if v_inv.id is null or not private.is_group_manager(v_inv.group_id) then
    raise exception 'Invitation introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Cette invitation a déjà été acceptée.';
  end if;
  update public.group_invitations set revoked_at = coalesce(revoked_at, now()) where id = p_invitation_id;
end;
$$;

-- Aperçu d'un lien pour la personne connectée qui l'ouvre (informations minimales).
create or replace function public.get_invitation_preview(p_token text)
returns table (group_name text, member_name text, manager_name text, state text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inv    public.group_invitations;
  v_member public.group_members;
begin
  perform private.assert_active_user();
  select * into v_inv from public.group_invitations
  where token_hash = private.sha256_hex(coalesce(p_token, ''));
  if v_inv.id is null then
    return query select null::text, null::text, null::text, 'invalid'::text;
    return;
  end if;
  select * into v_member from public.group_members where id = v_inv.member_id;
  return query
  select g.name, v_member.full_name,
    coalesce((select m.full_name from public.group_members m where m.group_id = g.id and m.role = 'manager' limit 1), 'Responsable'),
    case
      when v_inv.accepted_at is not null then 'accepted'
      when v_inv.revoked_at is not null then 'revoked'
      when v_inv.expires_at < now() then 'expired'
      when g.status <> 'active' or v_member.status <> 'active' or v_member.profile_id is not null then 'unavailable'
      when g.owner_id = auth.uid()
        or exists (select 1 from public.group_members m
                   where m.group_id = g.id and m.profile_id = auth.uid() and m.status <> 'removed') then 'already_member'
      else 'valid'
    end
  from public.groups g where g.id = v_inv.group_id;
end;
$$;

-- Acceptation : rattache la fiche de membre au compte connecté. Renvoie l'identifiant du groupe.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv    public.group_invitations;
  v_member public.group_members;
  v_group  public.groups;
begin
  perform private.assert_active_user();
  select * into v_inv from public.group_invitations
  where token_hash = private.sha256_hex(coalesce(p_token, '')) for update;
  if v_inv.id is null then
    raise exception 'Lien d''invitation invalide.';
  end if;
  if v_inv.accepted_at is not null then
    if v_inv.accepted_by = auth.uid() then
      return v_inv.group_id; -- déjà accepté par cette personne : rien à refaire
    end if;
    raise exception 'Ce lien a déjà été utilisé.';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'Ce lien a été annulé par le responsable du groupe. Demandez-lui un nouveau lien.';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Ce lien a expiré. Demandez un nouveau lien au responsable du groupe.';
  end if;

  select * into v_group from public.groups where id = v_inv.group_id;
  select * into v_member from public.group_members where id = v_inv.member_id for update;
  if v_group.status <> 'active' or v_member.status <> 'active' or v_member.profile_id is not null then
    raise exception 'Cette invitation n''est plus utilisable.';
  end if;
  if v_group.owner_id = auth.uid() or exists (
    select 1 from public.group_members m
    where m.group_id = v_group.id and m.profile_id = auth.uid() and m.status <> 'removed'
  ) then
    raise exception 'Vous faites déjà partie de ce groupe.';
  end if;

  update public.group_members set profile_id = auth.uid() where id = v_member.id;
  update public.group_invitations set accepted_at = now(), accepted_by = auth.uid() where id = v_inv.id;
  return v_inv.group_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Correction traçable d'une cotisation
-- -----------------------------------------------------------------------------
alter table public.contributions
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles (id) on delete set null,
  add column cancellation_reason text check (char_length(cancellation_reason) <= 500);

comment on column public.contributions.cancellation_reason is
  'Motif d''une correction (cotisation enregistrée par erreur). L''ancienne date de paiement reste dans audit_logs.';

create or replace function public.cancel_contribution(p_contribution_id uuid, p_reason text)
returns public.contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contrib public.contributions;
  v_cycle   public.cycles;
begin
  perform private.assert_active_user();
  select * into v_contrib from public.contributions where id = p_contribution_id for update;
  select * into v_cycle from public.cycles where id = v_contrib.cycle_id;
  if v_contrib.id is null or not private.can_handle_money(v_cycle.group_id) then
    raise exception 'Cotisation introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indiquez le motif de la correction (au moins 5 caractères).';
  end if;
  if v_contrib.status <> 'confirmed' then
    raise exception 'Seule une cotisation confirmée peut être corrigée.';
  end if;
  if v_cycle.status <> 'active' then
    raise exception 'Le cycle n''est plus actif : la cotisation ne peut plus être corrigée.';
  end if;
  if exists (
    select 1 from public.payout_orders p where p.schedule_id = v_contrib.schedule_id and p.status = 'paid'
  ) then
    raise exception 'La cagnotte de ce tour a déjà été versée : la cotisation ne peut plus être corrigée.';
  end if;

  update public.contributions
  set status = 'cancelled',
      paid_at = null,
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = btrim(p_reason)
  where id = p_contribution_id
  returning * into v_contrib;
  return v_contrib;
end;
$$;

revoke all on function
  public.create_member_invitation(uuid),
  public.revoke_member_invitation(uuid),
  public.get_invitation_preview(text),
  public.accept_invitation(text),
  public.cancel_contribution(uuid, text)
from public, anon;
grant execute on function
  public.create_member_invitation(uuid),
  public.revoke_member_invitation(uuid),
  public.get_invitation_preview(text),
  public.accept_invitation(text),
  public.cancel_contribution(uuid, text)
to authenticated;
revoke all on function private.sha256_hex(text) from public, anon;
grant execute on function private.sha256_hex(text) to authenticated;
