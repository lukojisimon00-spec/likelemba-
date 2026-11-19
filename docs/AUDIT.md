# Audit et diagnostic — LIKELEMBA

Date : 19 novembre 2026. Branche auditée : `ccr-189ba268-oqm5nf` (dépôt `lukojisimon00-spec/likelemba-`).
Méthode : lecture du code, des migrations et de la configuration ; exécution du lint, des types, des tests
unitaires, des tests SQL, du build ; parcours réels dans un navigateur (Chromium, écrans de 320 à 360 px) sur
un PostgreSQL local avec toutes les migrations et PostgREST (le moteur d'API de Supabase).

> Limite de la vérification : la connexion des comptes a été **imitée** (jeton signé localement). Le vrai service
> de comptes Supabase (inscription, e-mail de confirmation, mot de passe oublié) n'a pas pu tourner ici et doit
> être testé sur votre projet Supabase.

## État du dépôt

| Élément | Constat |
|---|---|
| `main` | Contient seulement la première version (PR n° 1 fusionnée le 28/10/2026). |
| Branche de travail | 5 étapes de plus (modèle maman likelemba, groupes, cycles, logo, ajouts de cet audit). **Pas encore sur `main` : le site publié ne les contient pas.** |
| Vérification automatique GitHub (`.github/workflows/ci.yml`) | Lint, types, tests unitaires, tests SQL, build. Le build peut échouer à cause de l'avertissement de sécurité de Next.js (voir E). |
| Fichiers non suivis / modifications locales | Aucun. |

## A. Ce qui existe et fonctionne réellement (vérifié)

| Fonction | Preuve |
|---|---|
| Base de données : 14 tables, RLS sur toutes, droits par colonne, fonctions RPC, journal d'audit en ajout seul | 154 tests SQL (`npm run test:db`) |
| Pages publiques : accueil, mentions légales, confidentialité | build |
| Comptes : inscription, connexion, déconnexion, mot de passe oublié, profil | Code relu ; **à tester sur un vrai Supabase** |
| Protection des pages privées (proxy + vérification serveur `getClaims`) | navigateur : redirection vers la connexion |
| Groupes : créer, modifier, archiver ; devise USD/CDF ; part du maman likelemba avec aperçu du tour | 28 vérifications navigateur |
| Membres : ajouter, **modifier** (nouveau), retirer avec motif, historique conservé | navigateur |
| **Invitations par lien** (nouveau) : lien personnel à usage unique, 14 jours, envoi WhatsApp / partage / copie, acceptation | 27 tests SQL + navigateur |
| Bouton WhatsApp pour contacter un membre | navigateur |
| Cycles : participants, ordre (flèches, tirage au sort), calendrier, démarrage | 33 vérifications navigateur |
| Suivi : qui a payé / pas payé / en retard, qui a reçu / pas encore, bilan par membre | navigateur |
| Cotisations simulées avec reçu `SIM-…`, idempotence (double clic sans doublon) | tests SQL |
| **Correction traçable d'une cotisation** (nouveau) : annulation avec motif, impossible après versement | tests SQL + navigateur |
| **Rappel WhatsApp** aux membres qui n'ont pas payé (nouveau) | navigateur |
| Versement simulé, frais 1 USD par tour versé, règlement simulé des frais, clôture, annulation | tests SQL + navigateur |
| **Historique du groupe** lisible (nouveau), réservé au maman likelemba | navigateur |
| Tableau de bord : indicateurs réels + **« À surveiller »** (prochain bénéficiaire, retards) (nouveau) | navigateur |
| Confidentialité entre groupes : une personne extérieure reçoit « page introuvable » (404) | tests SQL + navigateur |
| Mobile : pas de défilement horizontal à 320 px, boutons de 48 px | navigateur |
| Logo et icônes d'installation | build |

## B. Existe mais demande une correction

| Problème | Gravité | Proposition |
|---|---|---|
| Après une erreur de saisie, les **listes déroulantes** des anciens formulaires (fréquence d'un groupe, rôle d'un membre) peuvent revenir à leur valeur par défaut (comportement de React 19). Corrigé dans le nouveau formulaire de correction. | Faible | Appliquer la même correction aux anciens formulaires (avec votre accord, car cela modifie l'existant). |
| Un cycle **en brouillon** garde la cotisation et la part du maman likelemba du moment de sa création, même si le groupe est modifié ensuite. | Faible | Recopier les montants du groupe au moment de démarrer le cycle. |
| La liste « Dernières activités » du tableau de bord reste générique (« Cotisation : ajouté »). | Faible | Réutiliser les phrases de l'historique. |
| Modèle de frais : « 1 USD par groupe et par cycle » est **abandonné** (confirmé par le propriétaire le 19/11/2026). | Info | Seul modèle : **1 USD par tour versé, pris sur la part du maman likelemba**. Plus aucune mention de l'ancien modèle dans le site ; les anciennes migrations restent intactes (historique). |

## C. Présent dans l'interface mais non fonctionnel

Aucun bouton factice trouvé : chaque bouton appelle une vraie opération en base. Ce qui est **volontairement simulé**,
et affiché comme tel (« SIMULATION — AUCUN ARGENT RÉEL ») : cotisations, versements et frais. Aucun argent ne circule.

## D. Pas encore développé

| Fonction | Priorité |
|---|---|
| Reçu imprimable / partageable d'une cotisation | Haute |
| Moyen de paiement et référence (ex. n° de transaction M-Pesa) sur une cotisation | Haute |
| Coordonnées de réception (Mobile Money du maman likelemba) : table prête, **pas d'écran** | Moyenne |
| Espace administrateur `/admin` (fonctions SQL prêtes, pas d'écran) | Moyenne |
| Paiements partiels | Moyenne (à décider : la base n'accepte aujourd'hui qu'un montant complet) |
| Transfert du rôle de maman likelemba à une autre personne | Moyenne |
| Rappels automatiques (SMS / WhatsApp Business) | Plus tard (service payant) |
| Application installable complète (PWA, hors ligne) | Plus tard ; **aucun fonctionnement hors ligne n'est promis** |
| Paiements réels | Phase 8 seulement (agrément, fournisseur, avis juridique) |
| Module « gestion commerciale » (stock, caisse, trésorerie) | **Produit distinct recommandé**, voir plus bas |

## E. Sécurité et architecture

| Point | État |
|---|---|
| RLS sur toutes les tables, droits par colonne, RPC `SECURITY DEFINER` avec `search_path = ''` | ✅ testé |
| Accès croisés entre groupes | ✅ testé (SQL + navigateur) |
| Jetons d'invitation : aléatoires (32 octets), seule l'empreinte SHA-256 est stockée, usage unique, expirent, révocables | ✅ testé |
| Aucune clé secrète dans le code ; seule la clé publique est utilisée | ✅ |
| Redirections limitées aux chemins internes | ✅ (y compris le nouveau retour vers une invitation après inscription) |
| En-têtes de sécurité (X-Frame-Options, nosniff, Referrer-Policy…) | ✅ |
| **Next.js 16.4.3 : vulnérabilité « modérée » connue** (fuite de cache avec `use cache` / `unstable_cache`). LIKELEMBA n'utilise pas ces fonctions : risque réel faible. Mais le build s'arrête au premier essai, ce qui peut bloquer GitHub et Vercel. | ⚠ Mise à jour 16.4.6 recommandée (en attente de votre accord) |
| Limitation des abus (trop de tentatives de connexion) | Gérée par Supabase Auth ; à vérifier dans les réglages du projet |
| Inscription depuis une invitation : Supabase doit autoriser l'adresse de retour `…/auth/confirm?suite=…` | ✅ Couvert par les adresses `…/**` déjà prévues dans `docs/DEPLOIEMENT.md` (étape A3) |

## F. Améliorations UX/UI prioritaires

1. Reçu de cotisation à montrer ou envoyer au membre (WhatsApp).
2. Indicateur de chargement : un essai global a été **retiré** car il cassait la page « introuvable » ; à refaire page par page.
3. Recherche d'un membre dans les grands groupes (au-delà d'une cinquantaine de personnes).
4. Phrases claires dans « Dernières activités » du tableau de bord.

## G. Services externes à connecter

| Service | Pourquoi | État |
|---|---|---|
| Supabase (projet réel) | Base + comptes | À créer / configurer (phase 3), puis appliquer les 7 migrations |
| Vercel | Mise en ligne | À relier à `main` |
| Envoi d'e-mails (SMTP : Resend, Brevo…) | E-mails de confirmation fiables | Avant ouverture au public |
| Fournisseur de paiement agréé | Paiements réels | Phase 8 uniquement |

## H. Obstacles avant un test par de vrais utilisateurs

1. Fusionner la branche de travail dans `main` (Pull Request, avec votre accord).
2. Mettre à jour Next.js (16.4.6) pour que le build passe du premier coup.
3. Projet Supabase réel : appliquer les migrations, configurer les adresses de retour, tester l'inscription par e-mail.
4. Déployer sur Vercel et refaire un parcours complet sur un vrai téléphone Android.

## I. Plan de travail priorisé

1. **Mise en ligne** : PR vers `main`, mise à jour Next.js, Supabase + Vercel (avec vous).
2. **Reçu** de cotisation (affichage + partage WhatsApp) et **moyen de paiement / référence** (nouvelle migration).
3. Écran des **coordonnées de réception** du maman likelemba (Mobile Money / banque, sans code PIN).
4. **Espace administrateur** (statistiques, groupes, suspension, journal).
5. Corrections faibles de la section B (avec votre accord).
6. Tests de bout en bout permanents dans le dépôt (Playwright) et dans la vérification GitHub.

## Note : module « gestion commerciale » (stock, caisse, trésorerie)

Recommandation : **ne pas l'intégrer à LIKELEMBA maintenant.** C'est un autre métier (ventes, stock, inventaire),
avec d'autres utilisateurs et d'autres règles. Le mélanger compliquerait l'application et retarderait le lancement.
Plus tard, il pourra devenir un **produit séparé** qui réutilise les mêmes briques (comptes Supabase, montants en
centimes, USD/CDF sans conversion automatique, journal d'audit). À décider une fois LIKELEMBA testé par de vrais groupes.
