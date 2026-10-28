import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { ResetRequestForm } from "../forms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <h1 className="text-2xl font-bold text-brand-900">Mot de passe oublié</h1>
      <p className="mt-1 mb-6 text-muted">
        Indiquez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe.
      </p>
      <ResetRequestForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/connexion" className="font-semibold text-brand-700 underline">
          Retour à la connexion
        </Link>
      </p>
    </Card>
  );
}
