/**
 * Traduit une erreur renvoyée par Supabase en message compréhensible.
 * Les règles métier de la base lèvent déjà des messages en français
 * (code P0001) : on les affiche tels quels. Les autres erreurs techniques
 * ne sont jamais montrées brutes à l'utilisateur.
 */
export type DbError = { code?: string; message?: string } | null | undefined;

export function dbErrorMessage(error: DbError, fallback = "L'opération a échoué. Vérifiez votre connexion et réessayez."): string {
  if (!error) return fallback;
  switch (error.code) {
    case "P0001":
      return error.message?.trim() || fallback;
    case "23505":
      return "Ce numéro de téléphone figure déjà parmi les membres de ce groupe.";
    case "23514":
      return "Une valeur saisie n'est pas acceptée. Vérifiez le formulaire.";
    case "42501":
      return "Accès refusé : vous n'avez pas le droit de faire cette opération.";
    default:
      // Erreur RLS sur insertion / modification
      if (error.message?.includes("row-level security")) {
        return "Accès refusé : vous n'avez pas le droit de faire cette opération.";
      }
      return fallback;
  }
}
