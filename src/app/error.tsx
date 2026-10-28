"use client";

import { buttonClass } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-brand-900">Un problème est survenu</h1>
      <p className="text-muted">
        La page n&apos;a pas pu être chargée. Vérifiez votre connexion internet, puis réessayez.
      </p>
      <button type="button" onClick={reset} className={buttonClass("primary")}>
        Réessayer
      </button>
    </main>
  );
}
