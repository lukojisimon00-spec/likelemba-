import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Client Supabase côté serveur (pages, actions serveur, routes).
 * Il agit au nom de l'utilisateur connecté : les politiques RLS s'appliquent.
 * Renvoie null si Supabase n'est pas encore configuré.
 */
export async function createClient() {
  // Lire les cookies en premier rend la page dynamique (jamais mise en cache),
  // même quand Supabase n'est pas encore configuré.
  const cookieStore = await cookies();
  const env = getSupabaseEnv();
  if (!env) return null;

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un composant serveur : le proxy se charge de rafraîchir la session.
        }
      },
    },
  });
}
