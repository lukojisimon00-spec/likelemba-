import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { NewPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function NewPasswordPage() {
  const user = await getCurrentUser();
  return (
    <Card>
      <h1 className="text-2xl font-bold text-brand-900">Choisir un nouveau mot de passe</h1>
      <div className="mt-6">
        {user ? (
          <NewPasswordForm />
        ) : (
          <Alert tone="error">
            Ce lien a expiré ou a déjà été utilisé.{" "}
            <Link href="/mot-de-passe-oublie" className="font-semibold underline">
              Demander un nouveau lien
            </Link>
          </Alert>
        )}
      </div>
    </Card>
  );
}
