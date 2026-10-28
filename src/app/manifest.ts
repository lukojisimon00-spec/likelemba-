import type { MetadataRoute } from "next";

// Base pour une future application installable (PWA). Aucun service worker pour l'instant.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LIKELEMBA",
    short_name: "LIKELEMBA",
    description: "Gestion des groupes de likelemba",
    lang: "fr",
    start_url: "/tableau-de-bord",
    display: "standalone",
    background_color: "#F6F7F2",
    theme_color: "#146B50",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
