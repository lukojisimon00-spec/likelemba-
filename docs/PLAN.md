# Plan et état d'avancement — LIKELEMBA

Dernière mise à jour : 28 octobre 2026.

## 1. Audit du dépôt (phase 1)

État trouvé au départ (branche `main`) :

| Fichier | Contenu | Décision |
|---|---|---|
| `README.md` | Deux lignes de présentation | Réécrit (documentation complète) |
| `index.html` | Page vitrine statique (HTML + CSS), sans formulaire ni compte | **Conservé tel quel** à la racine comme archive. Next.js l'ignore. Son contenu et sa palette de couleurs ont été repris dans la nouvelle page d'accueil. Il pourra être supprimé **avec votre accord**. |

Aucun code applicatif, aucune base de données, aucune configuration de déploiement n'existait.

## 2. Architecture retenue

```
Navigateur (téléphone / ordinateur)
        │  HTTPS
        ▼
Vercel ── Next.js 16 (pages + actions serveur, src/)
        │  clé publique + jeton de l'utilisateur
        ▼
Supabase ── Auth (comptes) + PostgreSQL
            • RLS : chaque ligne n'est visible que des personnes autorisées
            • droits par colonne : le navigateur ne peut écrire que certains champs
            • fonctions RPC : démarrer un cycle, enregistrer une cotisation simulée…
            • journal d'audit automatique (triggers)
        │
        ▼
Adaptateur de paiement (src/lib/payments) ── « simulation » uniquement dans le MVP
```

Pourquoi ces choix :
- **Next.js + Vercel** : déploiement automatique à chaque `git push`, offre gratuite suffisante pour un prototype.
- **Règles métier dans la base** : même si quelqu'un contourne l'interface, la base refuse les opérations interdites.
- **Pas de clé secrète Supabase** dans le MVP : toute l'application agit avec les droits de l'utilisateur connecté.
- **Pas de framework UI lourd** : Tailwind CSS + quelques composants maison (`src/components/ui.tsx`) → pages légères, adaptées aux connexions lentes.

## 3. Fonctionnalités du MVP par priorité

| Priorité | Fonctionnalité | État |
|---|---|---|
| P0 | Schéma de base, RLS, règles métier, journal d'audit | ✅ Fait et testé (101 tests SQL) |
| P0 | Inscription, connexion, déconnexion, mot de passe oublié, profil | ✅ Code fait — à vérifier avec un vrai projet Supabase |
| P0 | Page d'accueil, mentions légales et confidentialité (modèles) | ✅ Fait |
| P0 | Tableau de bord (indicateurs réels, vides tant qu'il n'y a pas de groupe) | ✅ Fait |
| P1 | Création et modification de groupes (interface) | ⏳ Phase 4 — la base est prête |
| P1 | Ajout, modification, retrait de membres (interface) | ⏳ Phase 4 |
| P1 | Cycles : participants, ordre des tours, préparation, frais, démarrage | ⏳ Phase 4 |
| P1 | Cotisations simulées, retards, reçus « SIMULATION » | ⏳ Phase 4 |
| P1 | Versements simulés et clôture de cycle | ⏳ Phase 4 |
| P2 | Invitation d'un membre à rattacher son compte | ⏳ Phase 4 (nouvelle migration) |
| P2 | Préférences de réception (Mobile Money / banque) | ⏳ Phase 4 — table prête |
| P2 | Espace administrateur (statistiques, suspension, journaux) | ⏳ Phase 5 — fonctions SQL prêtes |
| P3 | Application installable (PWA complète) | Plus tard (manifeste déjà présent) |
| P4 | Paiements réels | ❌ Phase 8 uniquement, après conformité (voir `docs/PAIEMENTS.md`) |

## 4. Étapes suivantes (petites étapes)

**Phase 3 — à finaliser par vous (5 à 15 min, voir README « Configurer Supabase »)**
1. Créer le projet Supabase et appliquer les 3 migrations.
2. Créer le projet Vercel, renseigner les variables d'environnement.
3. Tester une vraie inscription (e-mail de confirmation) et une connexion.

**Phase 4 — fonctionnalités métier (prochaines sessions avec Claude Code)**
1. Générer les types TypeScript de la base (`supabase gen types`).
2. Pages « Mes groupes » : liste, création, modification, archivage.
3. Page d'un groupe : membres (ajout, modification, retrait avec confirmation).
4. Cycle : choix des participants, ordre des tours (avec aperçu du calendrier), préparation, frais simulés, démarrage.
5. Suivi du cycle : échéances, cotisations attendues / reçues / en retard, enregistrement d'une cotisation simulée, reçu imprimable.
6. Versements simulés et clôture.
7. Invitation des membres (lien ou code) pour rattacher leur compte.

**Phase 5 — administration** : espace `/admin` (statistiques, groupes, journaux, suspension), tests de permissions supplémentaires.

**Phase 6 — tests de bout en bout** (Playwright) sur les parcours principaux, mobile et ordinateur.

**Phase 7 — déploiement de production** et vérification du site publié.

## 5. Risques identifiés

| Risque | Mesure |
|---|---|
| Réglementation : collecter ou reverser des fonds sans autorisation en RDC (BCC) | MVP 100 % simulé ; étude juridique obligatoire avant la phase 8 |
| Fournisseur « SaaSPay » non identifié | Aucune intégration ; adaptateur isolé ; voir `docs/PAIEMENTS.md` |
| Fuite de données entre groupes | RLS + tests d'accès croisés automatisés |
| Erreurs de calcul ou mélange de devises | Calculs en centimes, devises figées par cycle, tests |
| Perte de travail entre téléphone et ordinateur | GitHub comme source unique, procédure dans `docs/MULTI-APPAREILS.md` |
| Coûts cachés (Supabase, Vercel, e-mails) | Offres gratuites suffisantes pour le prototype ; limites listées dans `docs/DEPLOIEMENT.md` |
| Envoi d'e-mails limité par le serveur e-mail intégré de Supabase | Configurer un SMTP (ex. Resend, Brevo) avant l'ouverture au public |
| Pause automatique d'un projet Supabase gratuit inactif | Le relancer depuis le tableau de bord ; passer à l'offre payante au lancement |

## 6. Comptes et accès qui vous manquent

| Compte | Pourquoi | Coût |
|---|---|---|
| Supabase (supabase.com) | Base de données et comptes utilisateurs | Offre gratuite pour le prototype |
| Vercel (vercel.com), connecté à GitHub | Mise en ligne du site | Offre « Hobby » gratuite (usage non commercial) ; offre « Pro » payante pour un usage commercial |
| Nom de domaine (facultatif) | Adresse du type likelemba.cd | Payant (registraire) |
| Service d'envoi d'e-mails (avant lancement public) | Fiabilité des e-mails de confirmation | Offres gratuites limitées |
| Conseil juridique en RDC (avant paiements réels) | Agrément, KYC, protection des données | Payant |
| Fournisseur de paiement (phase 8) | Encaissements et versements réels | À déterminer |

Les tarifs et limites changent : vérifiez-les sur les sites officiels au moment de vous inscrire.

## 7. Décisions prises par défaut (modifiables)

Voir `docs/REGLES-METIER.md` pour le détail. En résumé :
- Un cycle compte autant de tours que de participants ; chaque participant cotise à chaque tour, bénéficiaire compris.
- Les frais (1 USD) sont créés quand le cycle passe « en préparation » et doivent être réglés (en simulation) avant le démarrage.
- Les participants et l'ordre des tours ne se modifient qu'en brouillon (chaque modification est journalisée).
- Un versement n'est possible que lorsque toutes les cotisations du tour sont confirmées.
- Un seul cycle ouvert à la fois par groupe.
- Fuseau horaire de référence : Kinshasa (UTC+1).
