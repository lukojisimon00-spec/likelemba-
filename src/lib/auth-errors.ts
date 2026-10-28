/** Traduit les erreurs Supabase Auth en messages simples, en français. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null): string {
  if (!error) return "Une erreur inattendue s'est produite. Réessayez.";
  switch (error.code) {
    case "invalid_credentials":
      return "Adresse e-mail ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien reçu par e-mail.";
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cette adresse. Essayez de vous connecter.";
    case "weak_password":
      return "Ce mot de passe est trop faible. Choisissez-en un plus long ou plus varié.";
    case "same_password":
      return "Le nouveau mot de passe doit être différent de l'ancien.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
    case "user_banned":
      return "Ce compte est bloqué. Contactez l'administrateur.";
    case "otp_expired":
      return "Ce lien a expiré. Demandez-en un nouveau.";
  }
  if (error.status === 0 || /fetch|network/i.test(error.message ?? "")) {
    return "Connexion au serveur impossible. Vérifiez votre connexion internet et réessayez.";
  }
  return "Une erreur s'est produite. Réessayez dans un instant.";
}
