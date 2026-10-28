import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité">
      <section>
        <h2>Données collectées</h2>
        <ul>
          <li>Compte : nom, adresse e-mail, numéro de téléphone (facultatif).</li>
          <li>Groupes : noms et numéros des membres saisis par le responsable, cotisations, tours.</li>
          <li>
            Préférences de réception : opérateur Mobile Money ou banque et numéro de compte. LIKELEMBA ne
            demande jamais de code PIN, de mot de passe bancaire ni de code de validation.
          </li>
          <li>Journal d&apos;audit : qui a fait quelle opération et quand.</li>
        </ul>
      </section>
      <section>
        <h2>Qui voit vos données</h2>
        <ul>
          <li>Les membres d&apos;un groupe voient uniquement les informations de ce groupe.</li>
          <li>Les coordonnées de réception ne sont visibles que par le membre concerné et les responsables de son groupe.</li>
          <li>L&apos;administrateur de la plateforme accède aux données nécessaires au support et à la sécurité.</li>
        </ul>
      </section>
      <section>
        <h2>Conservation</h2>
        <p>
          L&apos;historique financier n&apos;est pas effacé, afin de garantir la transparence du groupe.
          [À compléter : durées de conservation, procédure de suppression de compte.]
        </p>
      </section>
      <section>
        <h2>Vos droits</h2>
        <p>[À compléter : droit d&apos;accès, de rectification, contact du responsable du traitement, législation congolaise applicable.]</p>
      </section>
    </LegalPage>
  );
}
