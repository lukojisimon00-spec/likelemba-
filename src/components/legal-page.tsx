import type { ReactNode } from "react";
import { Logo } from "./logo";
import { SiteFooter } from "./site-footer";
import { Alert } from "./ui";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-bold text-brand-900">{title}</h1>
        <div className="mt-4">
          <Alert tone="warning" title="Document à compléter avant le lancement public">
            Ce texte est un modèle pour la phase de test. Il doit être complété et validé par un juriste
            connaissant le droit congolais avant toute ouverture au public.
          </Alert>
        </div>
        <div className="mt-8 flex flex-col gap-6 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-brand-900 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
