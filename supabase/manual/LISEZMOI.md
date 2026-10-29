# Morceaux pour une installation manuelle depuis un téléphone

La migration 2 (`supabase/migrations/20261028000200_business_rules.sql`, environ 1 000 lignes)
est difficile à copier en une fois sur un téléphone. Elle est découpée ici en 5 morceaux,
coupés entre deux instructions complètes.

- Exécutez-les **dans l'ordre 1 → 5**, chacun dans une **nouvelle requête vide** du SQL Editor.
- N'exécutez **pas** aussi le fichier complet de la migration 2 : c'est l'un **ou** l'autre.
- Les 5 morceaux mis bout à bout sont identiques au fichier d'origine (seules les 2 lignes
  de commentaire en tête de chaque morceau sont ajoutées). `npm run test:db` le vérifie.

La source de vérité reste `supabase/migrations/`. Si la migration 2 change, ces morceaux
doivent être régénérés.
