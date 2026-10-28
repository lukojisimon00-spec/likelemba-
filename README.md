# LIKELEMBA

**Ensemble, avançons.** Application web (SaaS) pour gérer les groupes de *likelemba* (tontine)
en République démocratique du Congo : groupes, membres, cycles, ordre des tours, cotisations,
versements et historiques, en **USD** ou en **CDF**.

> ⚠️ **Prototype — paiements simulés.** Aucun argent réel ne transite par LIKELEMBA.
> LIKELEMBA n'est pas un établissement financier.

## État du projet

| Partie | État |
|---|---|
| Base de données (tables, sécurité RLS, règles métier, journal d'audit) | ✅ Prête et testée |
| Page d'accueil, mentions légales, confidentialité | ✅ |
| Inscription, connexion, mot de passe oublié, profil | ✅ (à vérifier avec votre projet Supabase) |
| Tableau de bord | ✅ |
| Interfaces groupes, membres, cycles, cotisations | ⏳ Prochaine phase |
| Administration | ⏳ |
| Paiements réels | ❌ Pas avant validation juridique (voir `docs/PAIEMENTS.md`) |

Détail et prochaines étapes : [`docs/PLAN.md`](docs/PLAN.md).

## Technologies

Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL + Auth) · Vercel · Vitest.

## Démarrage rapide (ordinateur)

Prérequis : Git, Node.js 22, un projet Supabase (voir plus bas).

```bash
git clone https://github.com/lukojisimon00-spec/likelemba-.git
cd likelemba-
npm ci
cp .env.example .env.local     # puis remplissez les valeurs Supabase
npm run dev                    # ouvrez http://localhost:3000
```

Sans `.env.local`, le site s'affiche quand même, avec un message « Configuration Supabase manquante »
sur les pages de compte.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance le site en développement |
| `npm run check` | Lint + vérification des types + tests unitaires (avant chaque commit) |
| `npm test` | Tests unitaires seuls |
| `npm run test:db` | Applique les migrations sur un PostgreSQL local jetable et teste les permissions (nécessite PostgreSQL installé) |
| `npm run build` | Build de production (comme sur Vercel) |

Ces vérifications sont aussi lancées automatiquement par GitHub Actions (`.github/workflows/ci.yml`).

## Configurer Supabase et Vercel

Guide pas à pas : [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md). En résumé :

1. Créer un projet Supabase et appliquer, **dans l'ordre**, les fichiers de `supabase/migrations/`.
2. Régler l'authentification (confirmation par e-mail, URL de redirection, modèles d'e-mails).
3. Copier l'URL du projet et la clé **publishable** dans `.env.local` (et dans Vercel).
4. Importer le dépôt dans Vercel et ajouter les mêmes variables d'environnement.

## Structure

```
src/
  app/                    Pages (App Router)
    page.tsx              Page d'accueil publique
    (auth)/               Connexion, inscription, mot de passe (+ actions serveur)
    (app)/                Pages privées : tableau de bord, profil
    auth/confirm/         Retour des liens reçus par e-mail
    mentions-legales/, confidentialite/
  components/             Composants d'interface réutilisables
  content/features.ts     Fonctionnalités annoncées (disponible / en développement)
  lib/
    domain/               Règles métier pures : montants, devises, téléphone RDC, calendrier, frais, cycles
    payments/             Adaptateur de paiement (simulation uniquement)
    supabase/             Clients Supabase (serveur, proxy)
    validation/           Validation des formulaires (zod)
  proxy.ts                Rafraîchit la session et protège les pages privées
supabase/
  migrations/             Schéma SQL versionné (tables, RLS, fonctions)
  tests/                  Tests SQL des permissions et des règles
  config.toml             Configuration pour le développement local (Supabase CLI)
docs/                     Plan, règles métier, paiements, déploiement, multi-appareils
index.html                Ancien prototype statique (archive, non utilisé par Next.js)
CLAUDE.md                 Règles permanentes pour Claude Code
```

## Sécurité (résumé)

- Row Level Security sur toutes les tables : un utilisateur ne voit que les groupes dont il est membre.
- Droits par colonne : le navigateur ne peut pas modifier un statut, un montant ou un rôle sensible.
- Opérations sensibles (démarrer un cycle, enregistrer une cotisation…) via des fonctions SQL contrôlées,
  avec protection contre les doubles opérations.
- Rôle administrateur attribué uniquement côté serveur.
- Aucune clé secrète dans le code ; `.env.local` n'est jamais envoyé sur GitHub.
- Journal d'audit en ajout seul.

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) — audit, architecture, priorités, risques, comptes nécessaires
- [`docs/REGLES-METIER.md`](docs/REGLES-METIER.md) — rôles, cycles, cotisations, frais
- [`docs/PAIEMENTS.md`](docs/PAIEMENTS.md) — simulation, vérification de « SaaSPay », conditions des paiements réels
- [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) — Supabase et Vercel pas à pas
- [`docs/MULTI-APPAREILS.md`](docs/MULTI-APPAREILS.md) — ordinateur, téléphone, sauvegardes
