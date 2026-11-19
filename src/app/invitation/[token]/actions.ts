"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { dbErrorMessage } from "@/lib/data/db-errors";
import type { FormState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/server";
import { tokenSchema } from "@/lib/validation/invitation";

export async function acceptInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = tokenSchema.safeParse(formData.get("token"));
  if (!token.success) return { error: "Lien d'invitation invalide." };

  const supabase = await createClient();
  if (!supabase) return { error: "La base de données n'est pas configurée." };
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "Votre session a expiré. Reconnectez-vous." };

  // La base vérifie tout : lien valable, non utilisé, non expiré, pas déjà membre.
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token.data });
  if (error || typeof data !== "string") return { error: dbErrorMessage(error, "Impossible d'accepter l'invitation.") };

  revalidatePath("/", "layout");
  redirect(`/groupes/${data}?bienvenue=1`);
}
