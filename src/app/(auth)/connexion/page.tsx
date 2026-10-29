import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfigMissing } from "@/components/config-missing";
import { Alert, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured, safeRedirectPath } from "@/lib/env";
import { SignInForm } from "../forms";

export const metadata: Metadata = { title: "Connexion" };

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  const params = await searchParams;
  const suite = safeRedirectPath(params.suite);
  if (await getCurrentUser()) redirect(suite);

  return (
    <Card>
      <h1 className="text-2xl font-bold text-brand-900">Connexion</h1>
      <p className="mt-1 mb-6 text-muted">Heureux de vous revoir.</p>
      <div className="flex flex-col gap-4">
        {!isSupabaseConfigured() && <ConfigMissing />}
        {params.deconnecte && <Alert tone="success">Vous êtes déconnecté. À bientôt !</Alert>}
        {params.erreur === "autre-navigateur" && (
          <Alert tone="info" title="Connectez-vous pour continuer">
            Le lien a été ouvert dans un autre navigateur que celui de l&apos;inscription. Si c&apos;était
            la confirmation de votre compte, votre adresse est confirmée : connectez-vous avec votre e-mail
            et votre mot de passe. S&apos;il s&apos;agissait d&apos;un nouveau mot de passe, refaites la
            demande depuis le même navigateur.
          </Alert>
        )}
        {params.erreur === "lien" && (
          <Alert tone="error">Ce lien est invalide ou a expiré. Reconnectez-vous ou demandez un nouveau lien.</Alert>
        )}
        <SignInForm suite={suite} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-brand-700 underline">
          Créer un compte
        </Link>
      </p>
    </Card>
  );
}
