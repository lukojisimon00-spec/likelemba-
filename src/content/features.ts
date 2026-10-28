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
    description: "Créez un groupe, fixez la devise (USD ou CDF), le montant, la fréquence et les règles.",
    available: false,
  },
  {
    title: "Cycles et ordre des tours",
    description: "Définissez l'ordre des bénéficiaires et suivez le calendrier des échéances.",
    available: false,
  },
  {
    title: "Cotisations et reçus",
    description: "Enregistrez les cotisations, repérez les retards et remettez un reçu à chaque membre.",
    available: false,
  },
  {
    title: "Historique transparent",
    description: "Chaque opération est journalisée : personne ne peut effacer l'historique.",
    available: false,
  },
];
