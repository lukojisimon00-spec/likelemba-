# CLAUDE.md — règles permanentes du projet LIKELEMBA

Ce fichier est lu automatiquement par Claude Code au début de chaque session.
Il contient les règles à respecter **toujours**, quel que soit l'appareil utilisé.

## Contexte

- LIKELEMBA : SaaS de gestion de groupes de likelemba (tontine) en RDC.
- Propriétaire : débutant en programmation, travaille sur ordinateur **et** sur téléphone Android.
  → Expliquer simplement, donner les commandes exactes et préciser où les exécuter.
- Langue de l'interface et de la documentation : **français**.
- Plan et état d'avancement : `docs/PLAN.md` (à mettre à jour à la fin de chaque étape).

## Pile technique

- Next.js 16 (App Router, `src/`), React 19, TypeScript strict, Tailwind CSS 4.
- Supabase : PostgreSQL + Auth (`@supabase/ssr`). Migrations dans `supabase/migrations/`.
- Vercel pour l'hébergement. GitHub = source centrale du code.
- Tests : Vitest (`src/**/*.test.ts`) et tests SQL (`supabase/tests/`).
- ⚠️ Next.js 16 diffère des anciennes versions : lire `node_modules/next/dist/docs/` avant
  d'utiliser une API inconnue. `middleware.ts` s'appelle désormais `src/proxy.ts`.
- `cacheComponents` est volontairement **désactivé** (modèle plus simple : une page qui lit
  la session est dynamique). Ne pas l'activer sans revoir toutes les pages connectées.

## Commandes

```bash
npm run dev        # serveur de développement (http://localhost:3000)
npm run check      # lint + types + tests unitaires (à lancer avant chaque commit)
npm run test:db    # migrations + tests RLS sur un PostgreSQL local jetable
npm run build      # build de production (doit passer avant tout déploiement)
```

## Règles non négociables

### Argent et devises
1. **Paiements simulés uniquement.** Aucun transfert réel. `PAYMENTS_MODE` n'accepte que `simulation`.
   Les contraintes SQL `*_simulation_only` ne doivent pas être retirées sans validation explicite
   du propriétaire **et** les étapes de la phase 8 (`docs/PAIEMENTS.md`).
2. Deux devises : `USD` et `CDF`. **Ne jamais mélanger** deux devises dans un calcul
   (`addMoney` lève une erreur). Chaque groupe, cycle et opération enregistre sa devise.
3. Calculs en centimes entiers (`src/lib/domain/money.ts`), jamais en nombres flottants.
4. Frais LIKELEMBA : 1 USD par groupe et par cycle, toujours en USD, **jamais déduits** des
   sommes des membres, **jamais convertis** en CDF sans taux explicite enregistré.
5. Tout reçu ou écran de paiement simulé affiche « SIMULATION — AUCUN ARGENT RÉEL ».
6. Ne jamais collecter de code PIN, mot de passe bancaire ou code OTP.
7. Ne jamais présenter LIKELEMBA comme un établissement financier agréé.

### Sécurité
8. Les autorisations sont vérifiées **dans la base** (RLS, droits par colonne, fonctions RPC)
   **et** côté serveur ; jamais seulement dans l'interface.
9. Toute nouvelle table : `enable row level security` + politiques + droits explicites
   + test dans `supabase/tests/`. Tester les accès croisés entre groupes.
10. Les fonctions booléennes d'autorisation renvoient toujours `true`/`false`, jamais `NULL`
    (un `NULL` a déjà causé une faille, corrigée et couverte par un test).
11. Les fonctions `SECURITY DEFINER` fixent `set search_path = ''` et qualifient les objets.
12. Le rôle administrateur ne s'attribue que côté serveur (table `platform_admins`, SQL Editor).
13. Aucune clé secrète dans le code ni dans une variable `NEXT_PUBLIC_*`. Seul `.env.example`
    (sans vraie valeur) est versionné.
14. Vérifier la session avec `supabase.auth.getClaims()` côté serveur, pas `getSession()`.
15. Redirections : uniquement des chemins internes (`safeRedirectPath`).

### Données et historique
16. Ne jamais supprimer d'historique financier. Les membres sont « retirés » (`status = 'removed'`).
17. Le journal `audit_logs` est en ajout seul.
18. Modifier le schéma **uniquement** par une nouvelle migration datée ; ne jamais modifier une
    migration déjà appliquée en production.
19. Les données de démonstration sont marquées (`groups.is_demo = true`) et affichées comme telles.

### Façon de travailler
20. Ne jamais supprimer de fichier, réinitialiser une base ou forcer un `git push` sans l'accord
    explicite du propriétaire. Prévenir avant toute action destructive ou payante.
21. Ne jamais affirmer qu'une fonctionnalité marche sans l'avoir vérifiée (tests, build, navigateur).
22. La page d'accueil n'annonce comme « Disponible » que ce qui existe réellement
    (`src/content/features.ts`).
23. Ne jamais inventer d'URL d'API, de clé ou de réponse d'un fournisseur de paiement.
24. Interface mobile-first : boutons ≥ 48 px, pas de défilement horizontal à 320 px, textes en français.
25. Avant d'ajouter une dépendance, vérifier qu'elle est nécessaire.
26. Fin de chaque étape : bilan court (réalisé, fichiers, tests, reste à faire, prochaine action,
    reprise sur téléphone/ordinateur) et mise à jour de `docs/PLAN.md`.
