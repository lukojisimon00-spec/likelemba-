# Règles métier — LIKELEMBA (MVP)

Ces règles sont appliquées **dans la base de données** (migrations `supabase/migrations/`)
et reprises côté TypeScript (`src/lib/domain/`) pour l'affichage. Elles sont couvertes par
les tests `supabase/tests/10_permissions_and_rules.sql` et `src/**/*.test.ts`.

Si une règle ne correspond pas à la pratique de vos groupes, dites-le : on la changera
par une nouvelle migration.

## Rôles

| Rôle | Qui | Peut |
|---|---|---|
| Responsable (`manager`), appelé « maman likelemba » | Créateur du groupe (un seul) | Tout gérer : groupe, membres, cycles, frais, cotisations, versements, archivage |
| Trésorier (`treasurer`) | Désigné par le responsable | Enregistrer cotisations et versements simulés ; voir les coordonnées de réception |
| Membre (`member`) | Membre ayant rattaché son compte | Consulter son groupe, les membres, le calendrier, les cotisations |
| Membre sans compte | Ajouté par le responsable (nom + téléphone) | Rien en ligne ; il est géré par le responsable |
| Administrateur | Attribué uniquement côté serveur | Voir les groupes, cycles et journaux ; suspendre un compte (motif obligatoire) ; modifier les paramètres. **Ne voit pas** les coordonnées de réception des membres. |

## Groupe

- Devise `USD` ou `CDF`, figée dès que le groupe a un cycle.
- Montant de cotisation > 0, fréquence : chaque semaine, toutes les deux semaines ou chaque mois.
- Nombre maximal de membres : entre 2 et 500.
- **Part du maman likelemba** (`organizer_commission`) : montant fixe gardé par le responsable à chaque tour,
  dans la devise du groupe. Copiée dans le cycle à sa création, puis figée.
- Le responsable ne peut pas être changé ni retiré (transfert prévu plus tard).
- Archivage possible seulement sans cycle ouvert ; un groupe archivé n'est plus modifiable.
- Pas de suppression : l'historique est conservé.

## Membres

- Numéro au format RDC : `+243` suivi de 9 chiffres commençant par 8 ou 9.
  Saisies acceptées : `0812345678`, `+243 81 234 5678`, `00243…`.
- Un même numéro ne peut figurer qu'une fois parmi les membres non retirés d'un groupe.
- Retrait (`status = 'removed'`) avec motif ; impossible si le membre participe à un cycle
  en préparation ou actif. Son historique reste visible.

## Cycle

États : **brouillon → en préparation → actif → terminé**, ou **annulé** (avec motif).

| Étape | Règles |
|---|---|
| Création | Copie la devise, le montant et la fréquence du groupe. Un seul cycle ouvert par groupe. Numérotation automatique. |
| Brouillon | Choix des participants (membres actifs) et de l'ordre des bénéficiaires. Chaque modification est journalisée. |
| Passage en préparation | Au moins 2 participants ; ordre complet de 1 à n sans trou. Part du maman likelemba > 0, inférieure à la cagnotte et, en USD, d'au moins 1 USD. Participants verrouillés. |
| Retour en brouillon | Toujours possible depuis « en préparation ». |
| Démarrage | Génère le calendrier : un tour par participant, et un versement prévu par tour. |
| Fin | Tous les versements effectués. |
| Annulation | Motif obligatoire (≥ 5 caractères). Les versements en attente sont annulés ; les opérations déjà faites et les frais des tours déjà versés sont conservés. |

### Calendrier et montants

- Tour 1 = date de début ; tour suivant = + 7 jours, + 14 jours ou + 1 mois.
  En mensuel, une date au 31 passe au dernier jour des mois plus courts (31 janvier → 28 février).
- À chaque tour, **chaque participant verse la cotisation, bénéficiaire compris**.
- Cagnotte du tour : `cotisation × nombre de participants`.
- Le maman likelemba garde sa part ; le bénéficiaire reçoit : `cagnotte − part du maman likelemba`.
- Exemple : 10 participants à 10 USD, part de 10 USD → cagnotte 100 USD, bénéficiaire **90 USD**,
  maman likelemba **10 USD** (dont 1 USD pour LIKELEMBA : il lui reste 9 USD).
- Les frais LIKELEMBA ne sont **jamais** retirés de la somme du bénéficiaire.

### Préparation depuis l'interface

- Le maman likelemba choisit les participants et l'ordre (flèches ou tirage au sort) ; l'ordre est enregistré
  en une seule opération (`set_cycle_order`), puis le cycle est préparé et démarré.
- Bilan par membre (`cycle_member_summary`) : cotisations dues à ce jour, payées, en retard, et si la cagnotte
  a déjà été reçue. Visible des membres du groupe uniquement (RLS).

## Confidentialité

- Chaque utilisateur ne voit **que** les groupes qu'il a créés ou dont il est membre rattaché, et leurs membres.
- Les frais LIKELEMBA ne sont visibles que du maman likelemba (et de l'administrateur de la plateforme).

## Cotisations (simulées)

- Montant et devise repris de l'échéance : le navigateur ne peut pas les choisir.
- Une seule cotisation en attente ou confirmée par participant et par échéance.
- Chaque demande porte une **clé d'idempotence** : rejouer la même demande (double clic,
  connexion coupée) renvoie la même opération au lieu d'en créer une seconde.
- Reçu numéroté `SIM-AAAAMMJJ-XXXXXXXX`, toujours marqué « SIMULATION — AUCUN ARGENT RÉEL ».
- Un échec simulé peut être enregistré pour tester l'affichage ; une nouvelle tentative est alors possible.
- Une échéance est **en retard** si sa date est passée sans cotisation confirmée
  (date du jour calculée à l'heure de Kinshasa).

## Versements (simulés)

- Possibles seulement quand toutes les cotisations du tour sont confirmées.
- Un versement déjà effectué ne peut pas l'être une seconde fois.

## Frais LIKELEMBA

- **1 USD par tour versé** (paramètre `service_fee_amount_usd`), décision du propriétaire du 19/11/2026.
- Créés automatiquement (statut « à régler ») au moment où le versement du tour est effectué :
  pas de versement, pas de frais. Pris sur la part du maman likelemba.
- Un tour versé une seule fois = des frais créés une seule fois.
- Toujours en USD, même pour un groupe en CDF ; aucune conversion automatique.
  (Dans un groupe en CDF, la part du maman likelemba est en CDF et le maman likelemba doit 1 USD par tour.)
- Les anciennes lignes de frais « par cycle » (avant la migration du 19/11/2026) sont conservées telles quelles.
- Visibles du responsable et de l'administrateur seulement.

## Destination des fonds (préférences)

- Mobile Money (opérateur + numéro) ou compte bancaire (banque + numéro de compte).
- **Aucun** code PIN, mot de passe ou code de validation n'est demandé ni stocké.
- Les numéros sont masqués (`***`) dans le journal d'audit.
