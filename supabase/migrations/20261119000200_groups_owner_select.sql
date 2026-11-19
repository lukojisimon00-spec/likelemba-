-- =============================================================================
-- LIKELEMBA — Migration 5 : le responsable peut relire le groupe qu'il vient de créer
-- -----------------------------------------------------------------------------
-- Bug trouvé lors du test de la page « Créer un groupe » (19/11/2026) :
-- « insert into groups … returning id » échouait avec « new row violates
-- row-level security policy ». La politique groups_select passe par
-- private.is_group_member(id), qui interroge la table groups : au moment du
-- contrôle, la nouvelle ligne n'y est pas encore visible.
--
-- Correctif : une politique de lecture supplémentaire, évaluée directement sur
-- la ligne (aucune requête), pour le propriétaire du groupe. Les politiques
-- s'additionnent (OU) : les autres accès sont inchangés.
-- =============================================================================

create policy groups_select_owner on public.groups
  for select to authenticated
  using (owner_id = (select auth.uid()));
