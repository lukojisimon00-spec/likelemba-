/**
 * Fonctionnalités annoncées sur la page d'accueil.
 * Règle : `available` ne passe à true que lorsque la fonctionnalité existe
 * réellement et a été vérifiée. La page n'annonce rien de plus.
 */
export type Feature = { title: string; description: string; available: boolean };

export const FEATURES: Feature[] = [
  {
    title: "Compte sécurisé",
    description: "Inscription, connexion et mot de passe oublié, avec un profil personnel.",
    available: true,
  },
  {
    title: "Tableau de bord",
    description: "Vos groupes, membres, cycles en cours et prochaines échéances en un coup d'œil.",
    available: true,
  },
  {
    title: "Groupes et membres",
    description:
      "Créez un groupe, fixez la devise (USD ou CDF), la cotisation, votre part de maman likelemba et les règles. Ajoutez vos membres et contactez-les sur WhatsApp.",
    available: true,
  },
  {
    title: "Cycles et ordre des tours",
    description: "Choisissez l'ordre des bénéficiaires (ou tirez au sort) et suivez le calendrier des tours.",
    available: true,
  },
  {
    title: "Cotisations et reçus",
    description:
      "Voyez qui a payé, qui est en retard, qui a déjà reçu la cagnotte et qui attend son tour. Paiements simulés avec reçu numéroté.",
    available: true,
  },
  {
    title: "Historique transparent",
    description: "Chaque opération est journalisée : personne ne peut effacer l'historique.",
    available: false,
  },
];
