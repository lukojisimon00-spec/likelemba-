# Paiements — état actuel et intégration future

## Situation du MVP

- **Aucun argent réel.** Le seul fournisseur disponible est la simulation
  (`src/lib/payments/simulation.ts`).
- La base refuse toute opération non simulée (contraintes `contributions_simulation_only`,
  `payout_orders_simulation_only`, `service_fees_simulation_only`).
- `PAYMENTS_MODE` n'accepte que `simulation` (`src/lib/payments/index.ts`).

## Vérification du fournisseur « SaaSPay » (28 octobre 2026)

Recherches effectuées sur le web (recherches générales, en français et en anglais) :

| Point à vérifier | Résultat |
|---|---|
| Identité et site officiel | **Non confirmés.** Aucun site officiel de « SaaSPay » proposant une API de paiement n'a été trouvé. |
| Documentation API pour développeurs | **Introuvable.** |
| Disponibilité en RDC, CDF et USD, Mobile Money | **Non confirmées.** |
| Sandbox, webhooks, conditions marchand | **Inconnus.** |

Noms proches à **ne pas confondre** :
- « SAASPAY Payment Processing » : logiciel référencé sur des comparateurs (GetApp, Software Advice),
  orienté cartes bancaires et prélèvements ACH (États-Unis) ; aucune documentation technique publique
  ni mention de la RDC trouvée.
- **SasaPay** : plateforme d'Afrique de l'Est (Kenya, Tanzanie), un autre fournisseur.
- **Satispay** : portefeuille mobile européen.

➡️ **Aucune intégration SaaSPay n'a été écrite.** Aucune URL d'API, clé ou réponse n'a été inventée.

### Informations à fournir pour avancer

1. Le site officiel exact du fournisseur que vous appelez « SaaSPay » (ou le nom de l'entreprise).
2. Le contact commercial ou la personne qui vous l'a recommandé.
3. Un lien vers sa documentation développeur, s'il vous en a donné un.

### Fournisseurs couvrant la RDC repérés pendant la recherche (à étudier, non vérifiés)

Ces noms sont apparus dans les résultats comme proposant du Mobile Money en RDC. Leur statut,
leurs tarifs et leurs agréments **doivent être vérifiés** auprès d'eux avant tout choix :
pawaPay, FlexPay, Shwary, Nomba (collecte RDC en USD et CDF selon sa documentation), Nexera Pay.
Les opérateurs Mobile Money courants en RDC sont M-Pesa (Vodacom), Orange Money, Airtel Money et Afrimoney.

## Architecture prévue (adaptateur)

`src/lib/payments/types.ts` définit l'interface `PaymentProvider` :

- `createCollection()` : demande d'encaissement avec clé d'idempotence ;
- `getCollectionStatus()` : vérification côté serveur auprès du fournisseur (source de vérité) ;
- `verifyWebhook()` : authentification de la signature **avant** tout traitement.

Un fournisseur réel s'ajoutera dans `src/lib/payments/<fournisseur>.ts` sans toucher au reste.

## Conditions avant tout paiement réel (phase 8)

1. **Conformité** : consulter un juriste en RDC. Collecter des fonds pour des tiers et les reverser
   peut relever de la réglementation de la Banque Centrale du Congo (services de paiement,
   monnaie électronique). Le modèle « compte de collecte chez une banque ou un prestataire agréé »
   doit être validé juridiquement.
2. Choisir un fournisseur agréé, confirmer par écrit : pays, devises (CDF/USD), opérateurs,
   encaissements **et** versements, frais, vérification marchand (KYC/KYB).
3. Obtenir les accès sandbox ; ne jamais committer les clés (variables d'environnement Vercel).
4. Implémenter l'adaptateur : vérification serveur, webhooks signés, idempotence, journal des transactions.
5. Nouvelle migration pour autoriser les opérations réelles (retrait contrôlé des verrous `*_simulation_only`).
6. Tests sandbox complets, revue de sécurité, puis validation explicite du propriétaire avant la production.
