import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} LIKELEMBA — Prototype. LIKELEMBA n&apos;est pas un établissement financier.</p>
        <nav className="flex gap-4" aria-label="Informations légales">
          <Link href="/mentions-legales" className="underline-offset-4 hover:underline">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="underline-offset-4 hover:underline">
            Confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}
