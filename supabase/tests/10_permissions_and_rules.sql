-- =============================================================================
-- Tests des permissions (RLS) et des règles métier de LIKELEMBA.
-- Exécution : npm run test:db (voir supabase/tests/run-local.sh)
-- Chaque échec arrête le script avec un message explicite.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

-- -----------------------------------------------------------------------------
-- Outils de test
-- -----------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

-- Vérifie qu'une requête échoue avec un message contenant p_expected.
create function tests.throws(p_label text, p_sql text, p_expected text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_expected) in lower(sqlerrm)) = 0 then
      raise exception 'ÉCHEC [%] : erreur inattendue « % » (attendu : « % »)', p_label, sqlerrm, p_expected;
    end if;
    raise notice 'ok  %', p_label;
    return;
  end;
  raise exception 'ÉCHEC [%] : la requête aurait dû échouer', p_label;
end;
$$;

create function tests.eq(p_label text, p_actual anyelement, p_expected anyelement)
returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ÉCHEC [%] : obtenu « % », attendu « % »', p_label, p_actual, p_expected;
  end if;
  raise notice 'ok  %', p_label;
end;
$$;

create function tests.affected(p_sql text)
returns integer language plpgsql as $$
declare v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- Utilisateurs de test (comptes fictifs)
\set alice   '''00000000-0000-0000-0000-00000000a11c'''
\set bob     '''00000000-0000-0000-0000-000000000b0b'''
\set carol   '''00000000-0000-0000-0000-0000000ca201'''
\set fay     '''00000000-0000-0000-0000-000000000fa1'''
\set admin   '''00000000-0000-0000-0000-0000000ad111'''

insert into auth.users (id, email, raw_user_meta_data) values
  (:alice, 'alice@test.local', '{"full_name":"Maman Alice","phone":"+243812345678"}'),
  (:bob,   'bob@test.local',   '{"full_name":"Bob","phone":"0812"}'),
  (:carol, 'carol@test.local', '{"full_name":"Carol"}'),
  (:fay,   'fay@test.local',   '{"full_name":"Fay"}'),
  (:admin, 'admin@test.local', '{"full_name":"Admin"}');
insert into public.platform_admins (user_id, note) values (:admin, 'test');

select tests.eq('profil créé automatiquement à l''inscription',
  (select full_name from public.profiles where id = :alice), 'Maman Alice');
select tests.eq('numéro invalide ignoré à l''inscription',
  (select phone::text from public.profiles where id = :bob), null::text);
select tests.eq('fonction round_due_date (fin de mois)',
  private.round_due_date('2026-01-31', 'monthly', 2), date '2026-02-28');
select tests.eq('fonction round_due_date (hebdomadaire)',
  private.round_due_date('2026-11-02', 'weekly', 3), date '2026-11-16');

-- -----------------------------------------------------------------------------
-- Visiteur non connecté
-- -----------------------------------------------------------------------------
set role anon;
select tests.throws('anon ne lit pas les groupes', 'select * from public.groups', 'permission denied');
select tests.throws('anon ne lit pas les profils', 'select * from public.profiles', 'permission denied');
select tests.throws('anon ne lance pas de RPC',
  $q$select public.start_cycle(gen_random_uuid())$q$, 'permission denied');
reset role;

-- -----------------------------------------------------------------------------
-- Alice crée un groupe
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :alice)::text, false);
set role authenticated;

select tests.throws('owner_id ne peut pas être fourni par le navigateur',
  format($q$insert into public.groups (owner_id, name, currency, contribution_amount, frequency, max_members)
           values (%L, 'Pirate', 'USD', 10, 'weekly', 5)$q$, :bob),
  'permission denied');

insert into public.groups (name, description, currency, contribution_amount, frequency, max_members, rules)
values ('  Mamans de Lemba  ', 'Groupe test', 'USD', 10, 'weekly', 5, 'Cotisation chaque lundi');

select tests.eq('nom du groupe nettoyé', (select name from public.groups), 'Mamans de Lemba');
select tests.eq('le responsable est l''utilisateur connecté', (select owner_id from public.groups), :alice::uuid);
select tests.eq('le responsable est membre « manager »',
  (select role::text from public.group_members where profile_id = :alice), 'manager');

select tests.throws('montant négatif refusé',
  $q$insert into public.groups (name, currency, contribution_amount, frequency, max_members)
     values ('Test', 'USD', -5, 'weekly', 5)$q$, 'check constraint');
select tests.throws('devise inconnue refusée',
  $q$insert into public.groups (name, currency, contribution_amount, frequency, max_members)
     values ('Test', 'EUR', 5, 'weekly', 5)$q$, 'invalid input value');
select tests.throws('statut de démonstration non modifiable par le navigateur',
  $q$update public.groups set is_demo = true$q$, 'permission denied');

-- Ajout de membres
insert into public.group_members (group_id, full_name, phone)
select id, 'Carol Mbuyi', '+243991112233' from public.groups;
insert into public.group_members (group_id, full_name, phone)
select id, 'Dan Kabila', '+243851112233' from public.groups;
insert into public.group_members (group_id, full_name)
select id, 'Eve Ngalula' from public.groups;

select tests.throws('numéro RDC invalide refusé',
  $q$insert into public.group_members (group_id, full_name, phone)
     select id, 'Faux', '+33612345678' from public.groups$q$, 'drc_phone');
select tests.throws('doublon de numéro refusé',
  $q$insert into public.group_members (group_id, full_name, phone)
     select id, 'Doublon', '+243991112233' from public.groups$q$, 'duplicate key');
select tests.throws('rôle manager réservé au créateur',
  $q$insert into public.group_members (group_id, full_name, role)
     select id, 'Usurpateur', 'manager' from public.groups$q$, 'réservé au créateur');
select tests.throws('rattacher un compte arbitraire est interdit',
  format($q$insert into public.group_members (group_id, profile_id, full_name)
           select id, %L, 'X' from public.groups$q$, :bob), 'permission denied');

insert into public.group_members (group_id, full_name)
select id, 'Cinquième' from public.groups;
select tests.throws('nombre maximal de membres respecté',
  $q$insert into public.group_members (group_id, full_name) select id, 'Sixième' from public.groups$q$,
  'nombre maximal');
reset role;

-- Simulation de la future procédure d'invitation : Carol rattache son compte.
update public.group_members set profile_id = :carol where full_name = 'Carol Mbuyi';
-- Une place libre, pour que les refus suivants viennent bien de RLS.
update public.groups set max_members = 6;

-- -----------------------------------------------------------------------------
-- Accès croisés : Bob n'a rien à voir avec le groupe d'Alice
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :bob)::text, false);
set role authenticated;
select tests.eq('Bob ne voit pas le groupe d''Alice', (select count(*) from public.groups), 0::bigint);
select tests.eq('Bob ne voit pas les membres', (select count(*) from public.group_members), 0::bigint);
select tests.eq('Bob ne voit pas le profil d''Alice', (select count(*) from public.profiles where id = :alice), 0::bigint);
select tests.eq('Bob ne modifie rien chez Alice (0 ligne)',
  tests.affected($q$update public.groups set name = 'Piraté'$q$), 0);
reset role;

-- Bob tente une insertion en connaissant l'identifiant du groupe
select id as alice_group from public.groups \gset
select set_config('request.jwt.claims', json_build_object('sub', :bob)::text, false);
set role authenticated;
select tests.throws('Bob ne peut pas ajouter de membre chez Alice (identifiant connu)',
  format($q$insert into public.group_members (group_id, full_name) values (%L, 'Intrus')$q$, :'alice_group'),
  'row-level security');
select tests.throws('Bob ne peut pas créer de cycle chez Alice',
  format($q$insert into public.cycles (group_id, start_date) values (%L, '2026-11-02')$q$, :'alice_group'),
  'introuvable');
reset role;

-- -----------------------------------------------------------------------------
-- Carol, simple membre
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :carol)::text, false);
set role authenticated;
select tests.eq('Carol voit son groupe', (select count(*) from public.groups), 1::bigint);
select tests.eq('Carol voit les membres de son groupe', (select count(*) from public.group_members), 5::bigint);
select tests.throws('Carol ne peut pas ajouter de membre',
  format($q$insert into public.group_members (group_id, full_name) values (%L, 'Ajout')$q$, :'alice_group'),
  'row-level security');
select tests.eq('Carol ne modifie pas le groupe (0 ligne)',
  tests.affected($q$update public.groups set name = 'Modifié'$q$), 0);
select tests.eq('Carol ne voit pas le journal d''audit', (select count(*) from public.audit_logs), 0::bigint);
select tests.throws('Carol ne peut pas devenir administratrice',
  format($q$insert into public.platform_admins (user_id) values (%L)$q$, :carol), 'permission denied');
select tests.throws('Carol ne peut pas changer le statut de son compte',
  $q$update public.profiles set account_status = 'active'$q$, 'permission denied');
update public.profiles set full_name = 'Carol M.' where id = :carol;
select tests.eq('Carol peut modifier son nom', (select full_name from public.profiles where id = :carol), 'Carol M.');
reset role;

-- -----------------------------------------------------------------------------
-- Cycle complet
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :alice)::text, false);
set role authenticated;

select tests.throws('le navigateur ne fixe pas la devise du cycle',
  format($q$insert into public.cycles (group_id, start_date, currency) values (%L, '2026-11-02', 'CDF')$q$, :'alice_group'),
  'permission denied');

insert into public.cycles (group_id, start_date) values (:'alice_group', '2026-11-02');
select id as cycle1 from public.cycles \gset

select tests.eq('cycle numéroté automatiquement', (select cycle_number from public.cycles), 1);
select tests.eq('cycle en brouillon', (select status::text from public.cycles), 'draft');
select tests.eq('devise copiée du groupe', (select currency::text from public.cycles), 'USD');
select tests.throws('un seul cycle ouvert par groupe',
  format($q$insert into public.cycles (group_id, start_date) values (%L, '2026-12-01')$q$, :'alice_group'),
  'duplicate key');
select tests.throws('le statut ne se modifie pas directement',
  $q$update public.cycles set status = 'active'$q$, 'permission denied');

-- Participants : Alice 1, Carol 2, Dan 3, Eve 5 (trou volontaire)
insert into public.cycle_participants (cycle_id, member_id, payout_position)
select :'cycle1', id,
  case full_name when 'Maman Alice' then 1 when 'Carol Mbuyi' then 2 when 'Dan Kabila' then 3 else 5 end
from public.group_members where full_name in ('Maman Alice', 'Carol Mbuyi', 'Dan Kabila', 'Eve Ngalula');

select tests.throws('ordre des bénéficiaires sans trou',
  format('select public.prepare_cycle(%L)', :'cycle1'), 'sans trou');
update public.cycle_participants set payout_position = 4 where payout_position = 5;

select tests.throws('démarrage impossible sans préparation',
  format('select public.start_cycle(%L)', :'cycle1'), 'en préparation');
select public.prepare_cycle(:'cycle1');
select tests.eq('cycle en préparation', (select status::text from public.cycles), 'preparing');
select tests.eq('date de fin prévue calculée', (select planned_end_date from public.cycles), date '2026-11-23');
select tests.eq('frais de 1 USD dus', (select amount || ' ' || currency || ' ' || status from public.service_fees), '1.00 USD due');

select tests.throws('participants verrouillés en préparation',
  $q$update public.cycle_participants set payout_position = payout_position$q$, 'brouillon');
select tests.throws('démarrage impossible sans frais réglés',
  format('select public.start_cycle(%L)', :'cycle1'), 'frais');

select public.pay_service_fee_simulated(:'cycle1');
select public.pay_service_fee_simulated(:'cycle1');
select tests.eq('frais réglés une seule fois',
  (select count(*) from public.audit_logs where entity_type = 'service_fees' and action = 'update' and details ? 'status'), 1::bigint);
select tests.throws('retour en brouillon impossible après règlement des frais',
  format('select public.return_cycle_to_draft(%L)', :'cycle1'), 'déjà réglés');

select public.start_cycle(:'cycle1');
select tests.eq('cycle actif', (select status::text from public.cycles), 'active');
select tests.eq('4 échéances créées', (select count(*) from public.contribution_schedules), 4::bigint);
select tests.eq('échéance du tour 2',
  (select due_date from public.contribution_schedules where round_number = 2), date '2026-11-09');
select tests.eq('montant du tour = 4 x 10 USD', (select distinct amount from public.payout_orders), 40.00::numeric);
select tests.eq('les frais ne sont pas déduits des versements',
  (select sum(amount) from public.payout_orders), 160.00::numeric);
select tests.throws('participants verrouillés après démarrage',
  $q$delete from public.cycle_participants$q$, 'brouillon');
select tests.throws('écriture directe de cotisation interdite',
  format($q$insert into public.contributions (cycle_id, schedule_id, participant_id, amount, currency, idempotency_key)
           select cycle_id, id, beneficiary_participant_id, 1, 'USD', 'abcdefgh123' from public.contribution_schedules limit 1$q$),
  'permission denied');
select tests.throws('écriture directe de versement interdite',
  $q$update public.payout_orders set status = 'paid'$q$, 'permission denied');

-- Cotisations du tour 1
select id as round1 from public.contribution_schedules where round_number = 1 \gset
select id as round2 from public.contribution_schedules where round_number = 2 \gset
select p.id as p_carol from public.cycle_participants p join public.group_members m on m.id = p.member_id
where m.full_name = 'Carol Mbuyi' \gset

select public.record_simulated_contribution(:'round1', id, 'r1-' || payout_position || '-key-0001')
from public.cycle_participants where cycle_id = :'cycle1';

select tests.eq('4 cotisations confirmées', (select count(*) from public.contributions where status = 'confirmed'), 4::bigint);
select tests.eq('reçus numérotés SIM-',
  (select bool_and(receipt_number like 'SIM-%') from public.contributions), true);
select tests.eq('montant et devise repris de l''échéance',
  (select string_agg(distinct amount || ' ' || currency, ',') from public.contributions), '10.00 USD');

select tests.eq('même clé = même opération (idempotence)',
  (select (public.record_simulated_contribution(:'round1', :'p_carol', 'r1-2-key-0001')).id)
    = (select id from public.contributions where idempotency_key = 'r1-2-key-0001'), true);
select tests.eq('toujours 4 cotisations', (select count(*) from public.contributions), 4::bigint);
select tests.throws('double cotisation refusée',
  format($q$select public.record_simulated_contribution(%L, %L, 'autre-cle-0001')$q$, :'round1', :'p_carol'),
  'déjà enregistrée');
select tests.throws('clé réutilisée pour une autre cotisation refusée',
  format($q$select public.record_simulated_contribution(%L, %L, 'r1-2-key-0001')$q$, :'round2', :'p_carol'),
  'déjà été utilisée');

-- Échec simulé puis nouvelle tentative
select public.record_simulated_contribution(:'round2', :'p_carol', 'r2-carol-fail-01', true);
select tests.eq('échec simulé enregistré',
  (select status::text from public.contributions where idempotency_key = 'r2-carol-fail-01'), 'failed');
select public.record_simulated_contribution(:'round2', :'p_carol', 'r2-carol-retry-01');
select tests.eq('nouvelle tentative acceptée après échec',
  (select status::text from public.contributions where idempotency_key = 'r2-carol-retry-01'), 'confirmed');

-- Versements
select id as payout1 from public.payout_orders where schedule_id = :'round1' \gset
select id as payout2 from public.payout_orders where schedule_id = :'round2' \gset
select tests.throws('versement impossible si cotisations incomplètes',
  format('select public.mark_payout_paid_simulated(%L)', :'payout2'), 'incomplètes');
select public.mark_payout_paid_simulated(:'payout1');
select public.mark_payout_paid_simulated(:'payout1');
select tests.eq('versement effectué une seule fois',
  (select count(*) from public.audit_logs where entity_type = 'payout_orders' and action = 'update' and details ? 'status'), 1::bigint);
select tests.throws('fin du cycle impossible avant tous les versements',
  format('select public.complete_cycle(%L)', :'cycle1'), 'Tous les bénéficiaires');
select tests.throws('retrait impossible d''un membre en cycle actif',
  format($q$select public.remove_group_member((select member_id from public.cycle_participants where id = %L), 'test retrait')$q$, :'p_carol'),
  'cycle en cours');
select tests.throws('archivage impossible avec un cycle ouvert',
  format('select public.archive_group(%L)', :'alice_group'), 'cycle en cours');
reset role;

-- Carol (simple membre) ne peut pas enregistrer d'argent
select set_config('request.jwt.claims', json_build_object('sub', :carol)::text, false);
set role authenticated;
select tests.eq('Carol voit les cotisations de son groupe', (select count(*) from public.contributions) > 0, true);
select tests.eq('Carol ne voit pas les frais du groupe', (select count(*) from public.service_fees), 0::bigint);
select tests.throws('Carol ne peut pas enregistrer de cotisation',
  format($q$select public.record_simulated_contribution(%L, %L, 'carol-key-0001')$q$, :'round2', :'p_carol'),
  'accès refusé');
select tests.throws('Carol ne peut pas annuler le cycle',
  format($q$select public.cancel_cycle(%L, 'je veux annuler')$q$, :'cycle1'), 'accès refusé');
reset role;

-- Bob ne voit aucune donnée financière d'Alice
select set_config('request.jwt.claims', json_build_object('sub', :bob)::text, false);
set role authenticated;
select tests.eq('Bob ne voit aucune cotisation', (select count(*) from public.contributions), 0::bigint);
select tests.eq('Bob ne voit aucun versement', (select count(*) from public.payout_orders), 0::bigint);
select tests.throws('Bob ne peut pas enregistrer de cotisation chez Alice',
  format($q$select public.record_simulated_contribution(%L, %L, 'bob-key-00001')$q$, :'round2', :'p_carol'),
  'accès refusé');
-- Non-régression : un non-membre ne doit franchir aucun contrôle d'accès des RPC.
select tests.throws('Bob ne peut pas annuler le cycle d''Alice',
  format($q$select public.cancel_cycle(%L, 'sabotage externe')$q$, :'cycle1'), 'accès refusé');
select tests.throws('Bob ne peut pas payer de versement chez Alice',
  format('select public.mark_payout_paid_simulated(%L)', :'payout2'), 'accès refusé');
reset role;

-- Annulation puis archivage
select set_config('request.jwt.claims', json_build_object('sub', :alice)::text, false);
set role authenticated;
select tests.throws('motif d''annulation obligatoire',
  format($q$select public.cancel_cycle(%L, '')$q$, :'cycle1'), 'motif');
select public.cancel_cycle(:'cycle1', 'Test d''annulation');
select tests.eq('versements en attente annulés',
  (select count(*) from public.payout_orders where status = 'cancelled'), 3::bigint);
select tests.eq('versement déjà effectué conservé',
  (select count(*) from public.payout_orders where status = 'paid'), 1::bigint);
select tests.throws('un cycle annulé ne se modifie plus',
  format($q$update public.cycles set start_date = '2026-12-01' where id = %L$q$, :'cycle1'), 'brouillon');
select tests.eq('Alice voit le journal de son groupe', (select count(*) from public.audit_logs) > 10, true);
select tests.throws('le journal d''audit est en lecture seule',
  $q$delete from public.audit_logs$q$, 'permission denied');
select tests.eq('le téléphone est masqué dans le journal',
  (select bool_and(details ->> 'phone' = '***') from public.audit_logs
   where entity_type = 'group_members' and action = 'insert' and details ->> 'phone' is not null), true);

select public.remove_group_member(id, 'A quitté le groupe') from public.group_members where full_name = 'Dan Kabila';
select tests.eq('membre retiré mais conservé',
  (select status::text from public.group_members where full_name = 'Dan Kabila'), 'removed');
select tests.eq('l''historique du membre retiré est conservé',
  (select count(*) from public.contributions c join public.cycle_participants p on p.id = c.participant_id
   join public.group_members m on m.id = p.member_id where m.full_name = 'Dan Kabila'), 1::bigint);
select public.archive_group(:'alice_group');
select tests.eq('groupe archivé', (select status::text from public.groups), 'archived');
select tests.throws('groupe archivé non modifiable',
  $q$update public.groups set name = 'Nouveau nom'$q$, 'archivé');
reset role;

-- -----------------------------------------------------------------------------
-- Groupe en CDF : la devise du cycle est CDF, les frais restent en USD
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :fay)::text, false);
set role authenticated;
insert into public.groups (name, currency, contribution_amount, frequency, max_members)
values ('Groupe Matete', 'CDF', 25000, 'monthly', 3);
select id as fay_group from public.groups \gset
insert into public.group_members (group_id, full_name) values (:'fay_group', 'Membre CDF');
insert into public.cycles (group_id, start_date) values (:'fay_group', '2026-01-31');
select id as fay_cycle from public.cycles \gset
insert into public.cycle_participants (cycle_id, member_id, payout_position)
select :'fay_cycle', id, row_number() over (order by role) from public.group_members;
select public.prepare_cycle(:'fay_cycle');
select tests.eq('frais en USD même pour un groupe en CDF',
  (select currency::text || ' ' || amount from public.service_fees), 'USD 1.00');
select public.pay_service_fee_simulated(:'fay_cycle');
select public.start_cycle(:'fay_cycle');
select tests.eq('versement en CDF',
  (select distinct currency::text || ' ' || amount from public.payout_orders), 'CDF 50000.00');
select tests.eq('échéance mensuelle en fin de mois',
  (select due_date from public.contribution_schedules where round_number = 2), date '2026-02-28');
select tests.throws('devise du groupe figée après un cycle',
  $q$update public.groups set currency = 'USD'$q$, 'devise');
reset role;

-- -----------------------------------------------------------------------------
-- Administration
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', :carol)::text, false);
set role authenticated;
select tests.throws('une non-administratrice ne suspend personne',
  format($q$select public.admin_set_account_status(%L, 'suspended', 'test abusif')$q$, :bob), 'réservée aux administrateurs');
select tests.eq('une non-administratrice ne modifie pas les paramètres (0 ligne)',
  tests.affected($q$update public.platform_settings set value = '0'$q$), 0);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :admin)::text, false);
set role authenticated;
select tests.eq('l''administrateur voit tous les groupes', (select count(*) from public.groups), 2::bigint);
select tests.eq('l''administrateur ne voit pas les coordonnées de paiement',
  (select count(*) from public.payment_destinations), 0::bigint);
select tests.throws('motif de suspension obligatoire',
  format($q$select public.admin_set_account_status(%L, 'suspended', '')$q$, :bob), 'motif');
select public.admin_set_account_status(:bob, 'suspended', 'Comportement frauduleux (test)');
select tests.eq('suspension journalisée',
  (select count(*) from public.audit_logs where action = 'admin_set_account_status'), 1::bigint);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', :bob)::text, false);
set role authenticated;
select tests.throws('un compte suspendu ne crée pas de groupe',
  $q$insert into public.groups (name, currency, contribution_amount, frequency, max_members)
     values ('Groupe de Bob', 'USD', 5, 'weekly', 3)$q$, 'row-level security');
reset role;

\echo 'Tous les tests de base de données sont passés.'
