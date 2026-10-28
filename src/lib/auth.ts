import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  isSuspended: boolean;
  isAdmin: boolean;
};

/**
 * Utilisateur connecté, vérifié côté serveur (signature du jeton contrôlée
 * par getClaims). Renvoie null si personne n'est connecté.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const [{ data: profile }, { data: admin }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, account_status").eq("id", claims.sub).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", claims.sub).maybeSingle(),
  ]);

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? null,
    isSuspended: profile?.account_status === "suspended",
    isAdmin: Boolean(admin),
  };
}

/** À appeler en haut de chaque page privée. */
export async function requireUser(nextPath = "/tableau-de-bord"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(nextPath)}`);
  return user;
}
