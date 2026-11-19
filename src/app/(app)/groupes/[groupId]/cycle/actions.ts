"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbErrorMessage } from "@/lib/data/db-errors";
import type { FormState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/group";

/**
 * Toutes les opérations passent par les fonctions RPC de la base, qui vérifient
 * elles-mêmes les droits (responsable / trésorier), les montants et les états.
 * Ce fichier ne fait que valider la forme des données et enchaîner les appels.
 */

async function authed() {
  const supabase = await createClient();
  if (!supabase) return { error: "La base de données n'est pas configurée." } as const;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "Votre session a expiré. Reconnectez-vous." } as const;
  return { supabase } as const;
}

const isoDate = z.iso.date({ error: "Indiquez une date valide." });

function cyclePath(groupId: string, query = "") {
  return `/groupes/${groupId}/cycle${query ? `?${query}` : ""}`;
}

export async function launchCycleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = idSchema.safeParse(formData.get("groupId"));
  const startDate = isoDate.safeParse(formData.get("startDate"));
  const memberIds = z.array(idSchema).min(2).max(500).safeParse(formData.getAll("memberIds"));
  if (!groupId.success) return { error: "Groupe introuvable." };
  if (!startDate.success) return { fieldErrors: { startDate: "Indiquez la date du premier tour." } };
  if (!memberIds.success) return { error: "Choisissez au moins 2 participants." };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase } = ctx;

  // Cycle ouvert existant (brouillon ou en préparation après une erreur), sinon nouveau brouillon.
  const { data: open } = await supabase
    .from("cycles")
    .select("id, status")
    .eq("group_id", groupId.data)
    .in("status", ["draft", "preparing", "active"])
    .maybeSingle();
  if (open?.status === "active") return { error: "Un cycle est déjà en cours pour ce groupe." };

  let cycleId = open?.id as string | undefined;
  if (open?.status === "preparing") {
    const { error } = await supabase.rpc("return_cycle_to_draft", { p_cycle_id: cycleId });
    if (error) return { error: dbErrorMessage(error) };
  }
  if (cycleId) {
    const { error } = await supabase.from("cycles").update({ start_date: startDate.data }).eq("id", cycleId);
    if (error) return { error: dbErrorMessage(error) };
  } else {
    const { data, error } = await supabase
      .from("cycles")
      .insert({ group_id: groupId.data, start_date: startDate.data })
      .select("id")
      .single();
    if (error || !data) return { error: dbErrorMessage(error, "Impossible de créer le cycle.") };
    cycleId = data.id as string;
  }

  for (const [fn, args] of [
    ["set_cycle_order", { p_cycle_id: cycleId, p_member_ids: memberIds.data }],
    ["prepare_cycle", { p_cycle_id: cycleId }],
    ["start_cycle", { p_cycle_id: cycleId }],
  ] as const) {
    const { error } = await supabase.rpc(fn, args);
    if (error) {
      revalidatePath(cyclePath(groupId.data));
      return { error: dbErrorMessage(error, "Impossible de démarrer le cycle.") };
    }
  }

  revalidatePath("/", "layout");
  redirect(cyclePath(groupId.data, "demarre=1"));
}

export async function recordContributionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = idSchema.safeParse(formData.get("groupId"));
  const scheduleId = idSchema.safeParse(formData.get("scheduleId"));
  const round = z.coerce.number().int().positive().safeParse(formData.get("round"));
  const participants = z.array(idSchema).max(500).safeParse(formData.getAll("participantIds"));
  if (!groupId.success || !scheduleId.success || !round.success || !participants.success) {
    return { error: "Formulaire invalide. Actualisez la page." };
  }
  if (participants.data.length === 0) return { error: "Cochez au moins un membre qui a payé." };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error };

  let recorded = 0;
  for (const participantId of participants.data) {
    // Clé générée à l'affichage : un double envoi renvoie la même opération (idempotence).
    const key = String(formData.get(`key_${participantId}`) ?? "");
    if (key.length < 8) return { error: "Formulaire invalide. Actualisez la page." };
    const { error } = await ctx.supabase.rpc("record_simulated_contribution", {
      p_schedule_id: scheduleId.data,
      p_participant_id: participantId,
      p_idempotency_key: key,
    });
    if (error) {
      revalidatePath(cyclePath(groupId.data));
      return {
        error: `${recorded} paiement(s) enregistré(s), puis erreur : ${dbErrorMessage(error)}`,
      };
    }
    recorded++;
  }

  revalidatePath("/", "layout");
  redirect(cyclePath(groupId.data, `tour=${round.data}&enregistre=${recorded}`));
}

export async function payoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = idSchema.safeParse(formData.get("groupId"));
  const payoutId = idSchema.safeParse(formData.get("payoutId"));
  const round = z.coerce.number().int().positive().safeParse(formData.get("round"));
  if (!groupId.success || !payoutId.success || !round.success) return { error: "Formulaire invalide." };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.rpc("mark_payout_paid_simulated", { p_payout_id: payoutId.data });
  if (error) return { error: dbErrorMessage(error, "Impossible d'enregistrer le versement.") };

  revalidatePath("/", "layout");
  redirect(cyclePath(groupId.data, `tour=${round.data}&verse=1`));
}

export async function payFeeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = idSchema.safeParse(formData.get("groupId"));
  const feeId = idSchema.safeParse(formData.get("feeId"));
  if (!groupId.success || !feeId.success) return { error: "Formulaire invalide." };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.rpc("pay_service_fee_simulated", { p_fee_id: feeId.data });
  if (error) return { error: dbErrorMessage(error, "Impossible de régler ces frais.") };

  revalidatePath(cyclePath(groupId.data));
  redirect(cyclePath(groupId.data, "frais=1"));
}

export async function completeCycleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = idSchema.safeParse(formData.get("groupId"));
  const cycleId = idSchema.safeParse(formData.get("cycleId"));
  if (!groupId.success || !cycleId.success) return { error: "Formulaire invalide." };

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.rpc("complete_cycle", { p_cycle_id: cycleId.data });
  if (error) return { error: dbErrorMessage(error, "Impossible de terminer le cycle.") };

  revalidatePath("/", "layout");
  redirect(cyclePath(groupId.data, "termine=1"));
}

export async function cancelCycleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = idSchema.safeParse(formData.get("groupId"));
  const cycleId = idSchema.safeParse(formData.get("cycleId"));
  const reason = z.string().trim().min(5).max(500).safeParse(formData.get("reason"));
  if (!groupId.success || !cycleId.success) return { error: "Formulaire invalide." };
  if (!reason.success) {
    return { fieldErrors: { reason: "Indiquez le motif (au moins 5 caractères)." }, values: { reason: String(formData.get("reason") ?? "") } };
  }

  const ctx = await authed();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.rpc("cancel_cycle", { p_cycle_id: cycleId.data, p_reason: reason.data });
  if (error) return { error: dbErrorMessage(error, "Impossible d'annuler le cycle.") };

  revalidatePath("/", "layout");
  redirect(cyclePath(groupId.data, "annule=1"));
}
