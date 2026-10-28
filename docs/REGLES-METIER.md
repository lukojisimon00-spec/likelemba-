# Règles métier — LIKELEMBA (MVP)

Ces règles sont appliquées **dans la base de données** (migrations `supabase/migrations/`)
et reprises côté TypeScript (`src/lib/domain/`) pour l'affichage. Elles sont couvertes par
les tests `supabase/tests/10_permissions_and_rules.sql` et `src/**/*.test.ts`.

Si une règle ne correspond pas à la pratique de vos groupes, dites-le : on la changera
par une nouvelle migration.

## Rôles

| Rôle | Qui | Peut |
|---|---|---|
| Responsable (`manager`) | Créateur du groupe (un seul) | Tout gérer : groupe, membres, cycles, frais, cotisations, versements, archivage |
| Trésorier (`treasurer`) | Désigné par le responsable | Enregistrer cotisations et versements simulés ; voir les coordonnées de réception |
| Membre (`member`) | Membre ayant rattaché son compte | Consulter son groupe, les membres, le calendrier, les cotisations |
| Membre sans compte | Ajouté par le responsable (nom + téléphone) | Rien en ligne ; il est géré par le responsable |
| Administrateur | Attribué uniquement côté serveur | Voir les groupes, cycles et journaux ; suspendre un compte (motif obligatoire) ; modifier les paramètres. **Ne voit pas** les coordonnées de réception des membres. |

## Groupe

- Devise `USD` ou `CDF`, figée dès que le groupe a un cycle.
- Montant de cotisation > 0, fréquence : chaque semaine, toutes les deux semaines ou chaque mois.
- Nombre maximal de membres : entre 2 et 100.
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
| Passage en préparation | Au moins 2 participants ; ordre complet de 1 à n sans trou. Crée les frais LIKELEMBA (1 USD, statut « à régler »). Participants verrouillés. |
| Retour en brouillon | Possible tant que les frais ne sont pas réglés. |
| Démarrage | Frais réglés (ou offerts). Génère le calendrier : un tour par participant, et un versement prévu par tour. |
| Fin | Tous les versements effectués. |
| Annulation | Motif obligatoire (≥ 5 caractères). Les versements et frais en attente sont annulés ; les opérations déjà faites sont conservées. |

### Calendrier et montants

- Tour 1 = date de début ; tour suivant = + 7 jours, + 14 jours ou + 1 mois.
  En mensuel, une date au 31 passe au dernier jour des mois plus courts (31 janvier → 28 février).
- À chaque tour, **chaque participant verse la cotisation, bénéficiaire compris**.
- Le bénéficiaire du tour reçoit : `cotisation × nombre de participants`.
  Exemple : 4 participants à 10 USD → 40 USD par tour.
- Les frais LIKELEMBA ne sont **jamais** retirés de ce montant.

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

- 1 USD par groupe et par cycle (paramètre `service_fee_amount_usd`).
- Toujours en USD, même pour un groupe en CDF ; aucune conversion automatique.
- Visibles du responsable et de l'administrateur seulement.

## Destination des fonds (préférences)

- Mobile Money (opérateur + numéro) ou compte bancaire (banque + numéro de compte).
- **Aucun** code PIN, mot de passe ou code de validation n'est demandé ni stocké.
- Les numéros sont masqués (`***`) dans le journal d'audit.
