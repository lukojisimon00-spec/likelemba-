# Plan et état d'avancement — LIKELEMBA

Dernière mise à jour : 19 novembre 2026.

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
| P0 | Schéma de base, RLS, règles métier, journal d'audit | ✅ Fait et testé (154 tests SQL) |
| P0 | Modèle « maman likelemba » : part du responsable par tour, 1 USD LIKELEMBA par tour versé | ✅ Base + calculs faits et testés (migration du 19/11/2026) — interface en phase 4 |
| P1 | Contacter un membre sur WhatsApp (lien wa.me pré-rempli) | ✅ Bouton sur la page du groupe |
| P0 | Inscription, connexion, déconnexion, mot de passe oublié, profil | ✅ Code fait — à vérifier avec un vrai projet Supabase |
| P0 | Page d'accueil, mentions légales et confidentialité (modèles) | ✅ Fait |
| P0 | Tableau de bord (indicateurs réels, vides tant qu'il n'y a pas de groupe) | ✅ Fait |
| P1 | Création, modification, archivage de groupes (interface) | ✅ Fait — testé dans un navigateur (360 et 320 px) sur une base locale |
| P1 | Ajout, modification et retrait de membres (interface) | ✅ Fait et testé |
| P1 | Cycles : participants, ordre des tours (flèches ou tirage au sort), calendrier, démarrage | ✅ Fait et testé dans le navigateur |
| P1 | Suivi : qui a payé / pas payé / en retard, qui a reçu / pas encore reçu, reçus SIM- | ✅ Fait et testé (reçu imprimable : à faire) |
| P1 | Versements simulés, frais 1 USD par tour, clôture et annulation de cycle | ✅ Fait et testé |
| P2 | Invitation d'un membre par lien (WhatsApp, partage, copie) | ✅ Fait et testé (migration 20261119000400) |
| P1 | Correction traçable d'une cotisation, rappel WhatsApp, historique du groupe, « À surveiller » | ✅ Fait et testé |
| P2 | Préférences de réception (Mobile Money / banque) | ⏳ Phase 4 — table prête |
| P2 | Espace administrateur (statistiques, suspension, journaux) | ⏳ Phase 5 — fonctions SQL prêtes |
| P3 | Application installable (PWA complète) | Plus tard (manifeste et icônes du nouveau logo prêts) |
| — | Logo professionnel (proposition B « la pièce qui tourne ») | ✅ Installé ; propositions A et C disponibles |
| P4 | Paiements réels | ❌ Phase 8 uniquement, après conformité (voir `docs/PAIEMENTS.md`) |

## 3 bis. Modèle économique (décision du propriétaire, 19/11/2026)

- Cagnotte d'un tour = cotisation × nombre de participants.
- Le **maman likelemba** (créateur/responsable du groupe) garde une part fixe par tour, qu'il choisit.
- Le bénéficiaire reçoit la cagnotte moins cette part. Exemple : 10 × 10 USD = 100 USD → 90 USD au
  bénéficiaire, 10 USD au maman likelemba.
- LIKELEMBA prend **1 USD par tour versé**, sur la part du maman likelemba (il lui reste 9 USD).
- Les cotisations doivent arriver sur **un seul compte** : celui du maman likelemba (Mobile Money ou
  banque). LIKELEMBA ne garde jamais l'argent.
- Pour l'instant tout reste **simulé** (règle n° 1). Le circuit réel (encaissement sur le compte du
  maman likelemba, prélèvement automatique du 1 USD, membres sans Mobile Money) relève de la phase 8 :
  il demande un fournisseur de paiement agréé et un avis juridique (voir `docs/PAIEMENTS.md`).

Points encore à confirmer par le propriétaire :
1. Groupe en francs congolais : la part du maman likelemba est en CDF, mais les frais LIKELEMBA
   restent 1 USD (aucune conversion automatique). Faut-il plutôt un montant fixe en CDF pour ces groupes ?
2. La part du maman likelemba est-elle toujours égale à une cotisation (10 USD dans l'exemple),
   ou libre ? Aujourd'hui elle est **libre** (proposée = une cotisation dans l'interface à venir).

## 4. Étapes suivantes (petites étapes)

**Phase 3 — à finaliser par vous (5 à 15 min, voir README « Configurer Supabase »)**
1. Créer le projet Supabase et appliquer les 3 migrations.
2. Créer le projet Vercel, renseigner les variables d'environnement.
3. Tester une vraie inscription (e-mail de confirmation) et une connexion.

**Phase 4 — fonctionnalités métier (prochaines sessions avec Claude Code)**
1. Générer les types TypeScript de la base (`supabase gen types`).
2. ✅ Pages « Mes groupes » : liste, création avec aperçu du tour, modification, archivage (19/11/2026).
3. ✅ Page d'un groupe : ajout et retrait de membres, bouton WhatsApp. Reste : modifier un membre.
4. ✅ Cycle : participants, ordre des tours, tirage au sort, aperçu du calendrier, démarrage (19/11/2026).
5. ✅ Suivi du cycle (page `/groupes/[id]/cycle`) : pointage des cotisations par cases à cocher, retards, bilan par
   membre. Reste : reçu imprimable, rappel WhatsApp aux retardataires.
6. ✅ Versements simulés, frais 1 USD par tour, clôture, annulation.
7. Invitation des membres (lien ou code) pour rattacher leur compte, partage du lien sur WhatsApp et Facebook.

**Phase 5 — administration** : espace `/admin` (statistiques, groupes, journaux, suspension), tests de permissions supplémentaires.

**Phase 6 — tests de bout en bout** (Playwright) sur les parcours principaux, mobile et ordinateur.

**Phase 7 — déploiement de production** et vérification du site publié.

### Vérification du 19/11/2026 (pages groupes)

Test de bout en bout dans Chromium (28 vérifications), sur un PostgreSQL local avec toutes les migrations
et PostgREST (le moteur d'API de Supabase). Seule la connexion était simulée : le vrai service de comptes
Supabase n'a pas pu être lancé ici. **À refaire sur votre vrai projet Supabase** (phase 3).
Bug trouvé et corrigé : la création d'un groupe était refusée par la base (migration `20261119000200`).

### Vérification du 19/11/2026 (cycles)

33 vérifications dans Chromium sur la même base locale : préparation (ordre, exclusion d'un membre, calendrier),
pointage, versement, frais, bilan, filtres, lecture seule pour un simple membre, refus (404) pour une personne
hors du groupe, annulation, affichage à 320 px. Le test des pages groupes (28 vérifications) a été relancé : OK.

**Confidentialité entre groupes** : un utilisateur ne voit que les groupes dont il est le maman likelemba ou
un membre rattaché. C'est imposé par la base (RLS), vérifié par les tests SQL et dans le navigateur.

### Audit du 19/11/2026

Diagnostic complet (A à I) : voir [`docs/AUDIT.md`](AUDIT.md). Prochaines priorités : mise en ligne (PR vers `main`,
mise à jour Next.js, Supabase + Vercel), reçu de cotisation, moyen de paiement / référence, coordonnées de
réception, espace administrateur.

## 5. Risques identifiés

| Risque | Mesure |
|---|---|
| Réglementation : collecter ou reverser des fonds sans autorisation en RDC (BCC) | MVP 100 % simulé ; étude juridique obligatoire avant la phase 8 |
| Fournisseur « SaaSPay » non identifié | Aucune intégration ; adaptateur isolé ; voir `docs/PAIEMENTS.md` |
| Fuite de données entre groupes | RLS + tests d'accès croisés automatisés |
| Argent centralisé sur le compte du maman likelemba (risque de fuite ou de fraude par celui-ci) | Historique complet et visible des membres ; avis juridique et règles anti-fraude avant la phase 8 |
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
- Les frais (1 USD) sont créés à chaque versement de tour, sur la part du maman likelemba ; ils ne bloquent pas le cycle.
- Nombre maximal de membres par groupe : 500 (au lieu de 100), car vous souhaitez un nombre « indéfini ».
- Les participants et l'ordre des tours ne se modifient qu'en brouillon (chaque modification est journalisée).
- Un versement n'est possible que lorsque toutes les cotisations du tour sont confirmées.
- Un seul cycle ouvert à la fois par groupe.
- Fuseau horaire de référence : Kinshasa (UTC+1).
