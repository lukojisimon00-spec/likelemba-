import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfigMissing } from "@/components/config-missing";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { SignUpForm } from "../forms";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/tableau-de-bord");
  return (
    <Card>
      <h1 className="text-2xl font-bold text-brand-900">Créer un compte</h1>
      <p className="mt-1 mb-6 text-muted">Gratuit pendant la phase de test.</p>
      <div className="flex flex-col gap-4">
        {!isSupabaseConfigured() && <ConfigMissing />}
        <SignUpForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-brand-700 underline">
          Se connecter
        </Link>
      </p>
    </Card>
  );
}
