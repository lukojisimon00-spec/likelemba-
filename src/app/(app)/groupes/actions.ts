"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage } from "@/lib/data/db-errors";
import { formValues, type FormState } from "@/lib/forms/state";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";
import { groupRow, groupSchema, idSchema, memberSchema, removeMemberSchema } from "@/lib/validation/group";

const GROUP_FIELDS = [
  "name",
  "description",
  "currency",
  "contributionAmount",
  "organizerCommission",
  "frequency",
  "maxMembers",
  "rules",
];

/**
 * Client Supabase + utilisateur vérifié côté serveur (getClaims).
 * Les droits réels sont ensuite contrôlés par la base (RLS, droits par colonne, triggers).
 */
async function authed() {
  const supabase = await createClient();
  if (!supabase) return { error: "La base de données n'est pas configurée." } as const;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "Votre session a expiré. Reconnectez-vous." } as const;
  return { supabase, userId: data.claims.sub } as const;
}

export async function createGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, GROUP_FIELDS);
  const parsed = groupSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error, values };

  const { data, error } = await ctx.supabase.from("groups").insert(groupRow(parsed.data)).select("id").single();
  if (error || !data) return { error: dbErrorMessage(error, "Impossible de créer le groupe."), values };

  revalidatePath("/", "layout");
  redirect(`/groupes/${data.id}?cree=1`);
}

export async function updateGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, GROUP_FIELDS);
  const groupId = idSchema.safeParse(formData.get("groupId"));
  if (!groupId.success) return { error: "Groupe introuvable.", values };
  const parsed = groupSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error, values };

  const { data, error } = await ctx.supabase
    .from("groups")
    .update(groupRow(parsed.data))
    .eq("id", groupId.data)
    .select("id");
  if (error) return { error: dbErrorMessage(error, "Impossible d'enregistrer le groupe."), values };
  if (!data?.length) return { error: "Seul le maman likelemba (responsable) peut modifier ce groupe.", values };

  revalidatePath("/", "layout");
  redirect(`/groupes/${groupId.data}?modifie=1`);
}

export async function archiveGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = idSchema.safeParse(formData.get("groupId"));
  if (!groupId.success) return { error: "Groupe introuvable." };
  if (formData.get("confirm") !== "on") return { error: "Cochez la case pour confirmer l'archivage." };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error };

  const { error } = await ctx.supabase.rpc("archive_group", { p_group_id: groupId.data });
  if (error) return { error: dbErrorMessage(error, "Impossible d'archiver le groupe.") };

  revalidatePath("/", "layout");
  redirect(`/groupes/${groupId.data}?archive=1`);
}

export async function addMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["fullName", "phone", "role"]);
  const groupId = idSchema.safeParse(formData.get("groupId"));
  if (!groupId.success) return { error: "Groupe introuvable.", values };
  const parsed = memberSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error, values };

  const { error } = await ctx.supabase.from("group_members").insert({
    group_id: groupId.data,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    role: parsed.data.role,
  });
  if (error) return { error: dbErrorMessage(error, "Impossible d'ajouter ce membre."), values };

  revalidatePath(`/groupes/${groupId.data}`);
  // Formulaire vidé pour enchaîner les ajouts.
  return { success: `${parsed.data.fullName} a été ajouté(e) au groupe.`, values: { role: "member" } };
}

export async function removeMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["reason"]);
  const memberId = idSchema.safeParse(formData.get("memberId"));
  const groupId = idSchema.safeParse(formData.get("groupId"));
  if (!memberId.success || !groupId.success) return { error: "Membre introuvable.", values };
  const parsed = removeMemberSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error, values };

  const { error } = await ctx.supabase.rpc("remove_group_member", {
    p_member_id: memberId.data,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: dbErrorMessage(error, "Impossible de retirer ce membre."), values };

  revalidatePath("/", "layout");
  // Le membre quitte la liste : la confirmation s'affiche en haut de la page du groupe.
  redirect(`/groupes/${groupId.data}?retire=1`);
}

/** Crée un lien d'invitation personnel pour un membre sans compte (jeton affiché une seule fois). */
export async function createInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const memberId = idSchema.safeParse(formData.get("memberId"));
  if (!memberId.success) return { error: "Membre introuvable." };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.supabase.rpc("create_member_invitation", { p_member_id: memberId.data });
  if (error || typeof data !== "string") return { error: dbErrorMessage(error, "Impossible de créer le lien.") };

  return { success: "Lien créé.", values: { link: `${getSiteUrl()}/invitation/${data}` } };
}

export async function revokeInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const invitationId = idSchema.safeParse(formData.get("invitationId"));
  const groupId = idSchema.safeParse(formData.get("groupId"));
  if (!invitationId.success || !groupId.success) return { error: "Invitation introuvable." };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.rpc("revoke_member_invitation", { p_invitation_id: invitationId.data });
  if (error) return { error: dbErrorMessage(error, "Impossible d'annuler le lien.") };

  revalidatePath(`/groupes/${groupId.data}`);
  return { success: "Lien annulé." };
}

/** Modification d'un membre : nom, téléphone et, sauf pour le responsable, rôle. */
export async function updateMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["fullName", "phone", "role"]);
  const memberId = idSchema.safeParse(formData.get("memberId"));
  const groupId = idSchema.safeParse(formData.get("groupId"));
  if (!memberId.success || !groupId.success) return { error: "Membre introuvable.", values };
  const isManager = formData.get("isManager") === "1";
  const parsed = memberSchema.safeParse({ ...values, role: isManager ? "member" : values.role });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error, values };
  const patch: { full_name: string; phone: string | null; role?: string } = {
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
  };
  if (!isManager) patch.role = parsed.data.role;
  const { data, error } = await ctx.supabase
    .from("group_members")
    .update(patch)
    .eq("id", memberId.data)
    .eq("group_id", groupId.data)
    .select("id");
  if (error) return { error: dbErrorMessage(error, "Impossible d'enregistrer ce membre."), values };
  if (!data?.length) return { error: "Seul le maman likelemba (responsable) peut modifier ce membre.", values };

  revalidatePath("/", "layout");
  redirect(`/groupes/${groupId.data}?membre=1`);
}
