/**
 * Lecture des variables d'environnement publiques.
 * L'application démarre même sans Supabase configuré : les pages concernées
 * affichent alors un message d'aide au lieu de planter.
 */

export type SupabaseEnv = { url: string; key: string };

export function getSupabaseEnv(): SupabaseEnv | null {
  // Espaces et retours à la ligne fréquents après un copier-coller sur téléphone.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key || key.includes("remplacez_moi")) return null;
  // Une adresse invalide ferait planter toutes les pages : on la traite comme absente.
  if (!isHttpUrl(url) || /\s/.test(key)) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

/** Adresse publique du site, pour les liens envoyés par e-mail. */
export function getSiteUrl(requestOrigin?: string | null): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (requestOrigin) return requestOrigin.replace(/\/$/, "");
  return "http://localhost:3000";
}

/**
 * N'autorise que les redirections internes (« /tableau-de-bord »), jamais
 * vers un autre site (« //pirate.com », « https://… »).
 */
export function safeRedirectPath(value: unknown, fallback = "/tableau-de-bord"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
