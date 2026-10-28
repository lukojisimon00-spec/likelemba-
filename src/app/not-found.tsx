import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-5xl font-extrabold text-brand-700">404</p>
      <h1 className="text-2xl font-bold text-brand-900">Page introuvable</h1>
      <p className="text-muted">Cette page n&apos;existe pas ou a été déplacée.</p>
      <ButtonLink href="/">Retour à l&apos;accueil</ButtonLink>
    </main>
  );
}
