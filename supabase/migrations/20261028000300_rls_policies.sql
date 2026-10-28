-- =============================================================================
-- LIKELEMBA — Migration 3 : Row Level Security et permissions
-- -----------------------------------------------------------------------------
-- Défense en profondeur :
--   1. Privilèges SQL : le rôle « authenticated » ne reçoit que les droits
--      nécessaires, colonne par colonne pour les écritures.
--   2. RLS : chaque ligne n'est visible que des personnes concernées.
--   3. Déclencheurs et fonctions RPC : règles métier (voir migration 2).
-- Le rôle « anon » (visiteur non connecté) n'a accès à aucune donnée privée.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Privilèges
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

-- Les nouvelles fonctions ne doivent pas être exécutables par défaut.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- Lecture (filtrée par RLS)
grant select on
  public.profiles,
  public.platform_admins,
  public.platform_settings,
  public.groups,
  public.group_members,
  public.cycles,
  public.cycle_participants,
  public.contribution_schedules,
  public.contributions,
  public.payout_orders,
  public.service_fees,
  public.payment_destinations,
  public.audit_logs
to authenticated;

-- Écritures directes autorisées, colonne par colonne.
-- Tout le reste (statuts, montants, frais, versements…) passe par les RPC.
grant update (full_name, phone) on public.profiles to authenticated;
grant update (value) on public.platform_settings to authenticated;

grant insert (name, description, currency, contribution_amount, frequency, max_members, rules)
  on public.groups to authenticated;
grant update (name, description, currency, contribution_amount, frequency, max_members, rules)
  on public.groups to authenticated;

grant insert (group_id, full_name, phone, role, joined_at) on public.group_members to authenticated;
grant update (full_name, phone, role, joined_at) on public.group_members to authenticated;

grant insert (group_id, start_date) on public.cycles to authenticated;
grant update (start_date) on public.cycles to authenticated;

grant insert (cycle_id, member_id, payout_position) on public.cycle_participants to authenticated;
grant update (payout_position) on public.cycle_participants to authenticated;
grant delete on public.cycle_participants to authenticated;

grant insert (member_id, destination_type, provider_name, account_holder_name, mobile_number, bank_account_number, is_default)
  on public.payment_destinations to authenticated;
grant update (provider_name, account_holder_name, mobile_number, bank_account_number, is_default)
  on public.payment_destinations to authenticated;
grant delete on public.payment_destinations to authenticated;

-- Actions métier
grant execute on function
  public.prepare_cycle(uuid),
  public.return_cycle_to_draft(uuid),
  public.pay_service_fee_simulated(uuid),
  public.start_cycle(uuid),
  public.record_simulated_contribution(uuid, uuid, text, boolean),
  public.mark_payout_paid_simulated(uuid),
  public.complete_cycle(uuid),
  public.cancel_cycle(uuid, text),
  public.remove_group_member(uuid, text),
  public.archive_group(uuid),
  public.admin_set_account_status(uuid, public.account_status, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Activation de RLS sur toutes les tables
-- -----------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.platform_admins        enable row level security;
alter table public.platform_settings      enable row level security;
alter table public.groups                 enable row level security;
alter table public.group_members          enable row level security;
alter table public.cycles                 enable row level security;
alter table public.cycle_participants     enable row level security;
alter table public.contribution_schedules enable row level security;
alter table public.contributions          enable row level security;
alter table public.payout_orders          enable row level security;
alter table public.service_fees           enable row level security;
alter table public.payment_destinations   enable row level security;
alter table public.audit_logs             enable row level security;

-- -----------------------------------------------------------------------------
-- 3. Politiques
-- -----------------------------------------------------------------------------

-- profiles : chacun voit et modifie son profil ; l'administrateur voit tout.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_platform_admin()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- platform_admins : chacun peut seulement savoir s'il est lui-même administrateur.
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_admin()));

-- platform_settings : paramètres non sensibles lisibles par tous les connectés.
create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using (true);
create policy platform_settings_update_admin on public.platform_settings
  for update to authenticated
  using ((select private.is_platform_admin()) and (select private.is_active_account()))
  with check ((select private.is_platform_admin()));

-- groups
create policy groups_select on public.groups
  for select to authenticated
  using (private.is_group_member(id) or (select private.is_platform_admin()));
create policy groups_insert on public.groups
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_active_account()));
create policy groups_update on public.groups
  for update to authenticated
  using (private.is_group_manager(id) and (select private.is_active_account()))
  with check (private.is_group_manager(id));

-- group_members : les membres d'un groupe se voient entre eux.
create policy group_members_select on public.group_members
  for select to authenticated
  using (private.is_group_member(group_id) or (select private.is_platform_admin()));
create policy group_members_insert on public.group_members
  for insert to authenticated
  with check (private.is_group_manager(group_id) and (select private.is_active_account()));
create policy group_members_update on public.group_members
  for update to authenticated
  using (private.is_group_manager(group_id) and (select private.is_active_account()))
  with check (private.is_group_manager(group_id));

-- cycles
create policy cycles_select on public.cycles
  for select to authenticated
  using (private.is_group_member(group_id) or (select private.is_platform_admin()));
create policy cycles_insert on public.cycles
  for insert to authenticated
  with check (private.is_group_manager(group_id) and (select private.is_active_account()));
create policy cycles_update on public.cycles
  for update to authenticated
  using (private.is_group_manager(group_id) and (select private.is_active_account()))
  with check (private.is_group_manager(group_id));

-- cycle_participants
create policy cycle_participants_select on public.cycle_participants
  for select to authenticated
  using (private.is_group_member(private.cycle_group_id(cycle_id)) or (select private.is_platform_admin()));
create policy cycle_participants_insert on public.cycle_participants
  for insert to authenticated
  with check (private.is_group_manager(private.cycle_group_id(cycle_id)) and (select private.is_active_account()));
create policy cycle_participants_update on public.cycle_participants
  for update to authenticated
  using (private.is_group_manager(private.cycle_group_id(cycle_id)) and (select private.is_active_account()))
  with check (private.is_group_manager(private.cycle_group_id(cycle_id)));
create policy cycle_participants_delete on public.cycle_participants
  for delete to authenticated
  using (private.is_group_manager(private.cycle_group_id(cycle_id)) and (select private.is_active_account()));

-- Tables financières : lecture seule pour les membres du groupe.
create policy contribution_schedules_select on public.contribution_schedules
  for select to authenticated
  using (private.is_group_member(private.cycle_group_id(cycle_id)) or (select private.is_platform_admin()));
create policy contributions_select on public.contributions
  for select to authenticated
  using (private.is_group_member(private.cycle_group_id(cycle_id)) or (select private.is_platform_admin()));
create policy payout_orders_select on public.payout_orders
  for select to authenticated
  using (private.is_group_member(private.cycle_group_id(cycle_id)) or (select private.is_platform_admin()));
-- Les frais concernent le responsable (et l'administrateur), pas les membres.
create policy service_fees_select on public.service_fees
  for select to authenticated
  using (private.is_group_manager(group_id) or (select private.is_platform_admin()));

-- payment_destinations : le membre lui-même et les responsables / trésoriers.
-- Volontairement non visibles par l'administrateur de la plateforme.
create policy payment_destinations_select on public.payment_destinations
  for select to authenticated
  using (private.is_own_member(member_id) or private.can_handle_money(private.member_group_id(member_id)));
create policy payment_destinations_insert on public.payment_destinations
  for insert to authenticated
  with check (
    (private.is_own_member(member_id) or private.is_group_manager(private.member_group_id(member_id)))
    and (select private.is_active_account())
  );
create policy payment_destinations_update on public.payment_destinations
  for update to authenticated
  using (
    (private.is_own_member(member_id) or private.is_group_manager(private.member_group_id(member_id)))
    and (select private.is_active_account())
  )
  with check (private.is_own_member(member_id) or private.is_group_manager(private.member_group_id(member_id)));
create policy payment_destinations_delete on public.payment_destinations
  for delete to authenticated
  using (
    (private.is_own_member(member_id) or private.is_group_manager(private.member_group_id(member_id)))
    and (select private.is_active_account())
  );

-- audit_logs : responsables de leur groupe et administrateurs. Aucune écriture.
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    (select private.is_platform_admin())
    or (group_id is not null and private.is_group_manager(group_id))
  );
