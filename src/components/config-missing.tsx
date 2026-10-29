import { Alert } from "./ui";

/** Affiché tant que les variables Supabase ne sont pas renseignées. */
export function ConfigMissing() {
  return (
    <Alert tone="warning" title="Configuration Supabase manquante ou invalide">
      <span className="break-words [&_code]:break-all">
        Les comptes ne sont pas encore activés sur cette installation. Renseignez{" "}
        <code>NEXT_PUBLIC_SUPABASE_URL</code> et <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (voir
        le fichier <code>README.md</code>, section « Configurer Supabase »). L&apos;adresse doit commencer
        par <code>https://</code> et se terminer par <code>.supabase.co</code>.
      </span>
    </Alert>
  );
}
