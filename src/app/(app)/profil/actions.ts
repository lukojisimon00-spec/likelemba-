"use server";

import { revalidatePath } from "next/cache";
import { formValues, type FormState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, profileSchema } from "@/lib/validation/auth";

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["fullName", "phone"]);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  if (!supabase) return { error: "La base de données n'est pas configurée.", values };

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "Votre session a expiré. Reconnectez-vous.", values };

  // Seules les colonnes full_name et phone sont modifiables (droits SQL + RLS).
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", userId);
  if (error) {
    return { error: "Impossible d'enregistrer le profil. Vérifiez votre connexion et réessayez.", values };
  }

  revalidatePath("/", "layout");
  return { success: "Profil enregistré.", values };
}
