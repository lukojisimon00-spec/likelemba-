import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Mentions légales et conditions d'utilisation" };

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales et conditions d'utilisation">
      <section>
        <h2>Éditeur du service</h2>
        <p>[À compléter : nom ou raison sociale, forme juridique, RCCM, identification nationale, adresse, contact.]</p>
      </section>
      <section>
        <h2>Hébergement</h2>
        <p>
          Application hébergée par Vercel Inc. ; base de données et authentification fournies par Supabase.
          [À compléter : adresses et régions d&apos;hébergement retenues.]
        </p>
      </section>
      <section>
        <h2>Nature du service</h2>
        <ul>
          <li>LIKELEMBA est un outil de gestion et de suivi des groupes de likelemba.</li>
          <li>
            LIKELEMBA n&apos;est ni une banque, ni un établissement de monnaie électronique, ni un établissement
            de paiement. Dans la version actuelle, aucun argent réel ne transite par la plateforme : les
            paiements affichés sont des simulations.
          </li>
          <li>Les responsables de groupes restent responsables de l&apos;organisation de leur groupe et de ses règles.</li>
        </ul>
      </section>
      <section>
        <h2>Tarif</h2>
        <p>
          Des frais de service de 1 USD par groupe et par cycle sont prévus. Pendant la phase de test, ces frais
          sont simulés et aucun paiement n&apos;est demandé.
        </p>
      </section>
      <section>
        <h2>Utilisation acceptable</h2>
        <p>[À compléter : obligations des utilisateurs, interdictions, suspension de compte, droit applicable, juridiction.]</p>
      </section>
    </LegalPage>
  );
}
