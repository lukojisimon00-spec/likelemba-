import Link from "next/link";
import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Alert } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Vérification côté serveur, en plus du proxy.
  const user = await requireUser();

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo href="/tableau-de-bord" />
          <nav aria-label="Navigation principale" className="flex items-center gap-1 text-sm font-semibold">
            <Link href="/tableau-de-bord" className="rounded-lg px-3 py-2 text-brand-700 hover:bg-brand-50">
              Tableau de bord
            </Link>
            <Link href="/profil" className="rounded-lg px-3 py-2 text-brand-700 hover:bg-brand-50">
              Profil
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="rounded-lg px-3 py-2 text-muted hover:bg-cream">
                Déconnexion
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        {user.isSuspended && (
          <div className="mb-6">
            <Alert tone="error" title="Compte suspendu">
              Votre compte est suspendu : vous pouvez consulter vos informations, mais aucune modification
              n&apos;est possible. Contactez l&apos;administrateur de LIKELEMBA.
            </Alert>
          </div>
        )}
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
