import Link from "next/link";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ButtonLink, Card } from "@/components/ui";
import { FEATURES } from "@/content/features";

const STEPS = [
  { title: "Créez votre compte", text: "Une adresse e-mail et un mot de passe suffisent." },
  { title: "Créez votre groupe", text: "Nom, devise (USD ou CDF), montant de la cotisation et fréquence." },
  { title: "Ajoutez les membres", text: "Nom et numéro de téléphone, puis l'ordre de passage de chacun." },
  { title: "Suivez chaque tour", text: "Cotisations reçues, retards, bénéficiaire du tour : tout est noté." },
];

const FAQ = [
  {
    q: "Qu'est-ce qu'un likelemba ?",
    a: "C'est une épargne collective : chaque membre verse la même somme à intervalle régulier, et à chaque tour un membre reçoit la totalité des cotisations, jusqu'à ce que tout le monde ait reçu son tour.",
  },
  {
    q: "LIKELEMBA garde-t-il mon argent ?",
    a: "Non. Dans cette version, LIKELEMBA est un outil de suivi : aucun argent réel ne transite par la plateforme. Les paiements affichés sont des simulations clairement indiquées. LIKELEMBA n'est pas une banque ni un établissement de monnaie électronique.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Le service prévoit des frais de 1 USD par groupe et par cycle, payés par le groupe à l'ouverture du cycle. Ces frais ne sont jamais retirés des sommes destinées aux membres. Pendant la phase de test, les frais sont simulés.",
  },
  {
    q: "Puis-je utiliser des francs congolais ?",
    a: "Oui. Chaque groupe choisit sa devise : dollar américain (USD) ou franc congolais (CDF). Les deux devises ne sont jamais mélangées dans un même calcul.",
  },
  {
    q: "Mes membres doivent-ils avoir un smartphone ?",
    a: "Non. Le responsable peut enregistrer un membre avec son nom et son numéro de téléphone, même si ce membre n'a pas de compte LIKELEMBA.",
  },
  {
    q: "Qui peut voir les informations de mon groupe ?",
    a: "Seulement les membres de votre groupe disposant d'un compte, selon leur rôle. Les autres utilisateurs ne voient rien. Ces règles sont appliquées directement dans la base de données.",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-2" aria-label="Compte">
            <Link href="/connexion" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              Se connecter
            </Link>
            {/* Sur mobile, le bouton d'inscription est dans le bandeau principal. */}
            <span className="hidden sm:block">
              <ButtonLink href="/inscription" className="min-h-10 px-4 text-sm">
                Créer un compte
              </ButtonLink>
            </span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4">
        <section className="mt-6 rounded-3xl bg-brand-900 px-6 py-10 text-white sm:mt-10 sm:px-12 sm:py-16">
          <p className="text-xs font-bold tracking-widest text-brand-200 uppercase">La solidarité organisée</p>
          <h1 className="mt-4 max-w-2xl text-4xl leading-tight font-extrabold sm:text-5xl">
            Votre likelemba, bien tenu et sans calculs à la main.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-brand-100">
            LIKELEMBA aide les mamans responsables et les trésoriers à suivre les membres, les tours et les
            cotisations de leurs groupes, en dollars ou en francs congolais.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/inscription" variant="light">
              Créer mon compte gratuitement
            </ButtonLink>
            <ButtonLink href="/connexion" className="border border-brand-200 bg-transparent hover:bg-brand-800">
              J&apos;ai déjà un compte
            </ButtonLink>
          </div>
          <p className="mt-6 text-sm text-brand-200">
            Version de test : les paiements sont simulés, aucun argent réel n&apos;est déplacé.
          </p>
        </section>

        <section className="py-12" aria-labelledby="avantages">
          <h2 id="avantages" className="text-2xl font-bold text-brand-900 sm:text-3xl">
            Pensé pour celles et ceux qui font vivre le groupe
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="text-lg font-bold text-brand-700">Pour les responsables et trésoriers</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-ink">
                <li>Fini le carnet perdu ou les calculs refaits trois fois.</li>
                <li>Voir d&apos;un coup d&apos;œil qui a payé et qui est en retard.</li>
                <li>Un ordre des tours clair, que personne ne peut changer en cachette.</li>
              </ul>
            </Card>
            <Card>
              <h3 className="text-lg font-bold text-brand-700">Pour les membres</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-ink">
                <li>Savoir quand c&apos;est votre tour et combien vous allez recevoir.</li>
                <li>Garder la trace de chaque cotisation versée.</li>
                <li>Plus de confiance grâce à un historique que tout le groupe peut consulter.</li>
              </ul>
            </Card>
          </div>
        </section>

        <section className="pb-12" aria-labelledby="etapes">
          <h2 id="etapes" className="text-2xl font-bold text-brand-900 sm:text-3xl">
            Comment ça marche
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-line bg-white p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-900">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-bold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="pb-12" aria-labelledby="fonctionnalites">
          <h2 id="fonctionnalites" className="text-2xl font-bold text-brand-900 sm:text-3xl">
            Fonctionnalités
          </h2>
          <p className="mt-2 text-muted">
            LIKELEMBA est en cours de construction. Voici ce qui est déjà disponible et ce qui arrive.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                    f.available ? "bg-brand-100 text-brand-900" : "bg-gold-100 text-gold-600"
                  }`}
                >
                  {f.available ? "Disponible" : "En développement"}
                </span>
                <h3 className="mt-3 font-bold text-ink">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="pb-12" aria-labelledby="tarif">
          <Card className="border-brand-200 bg-brand-50">
            <h2 id="tarif" className="text-2xl font-bold text-brand-900">
              Un tarif simple : 1 USD par groupe et par cycle
            </h2>
            <p className="mt-2 text-ink">
              Les frais sont payés par le groupe à l&apos;ouverture de chaque nouveau cycle. Ils ne sont jamais
              retirés de l&apos;argent destiné aux membres. Pendant la phase de test, ils sont simulés.
            </p>
          </Card>
        </section>

        <section className="pb-16" aria-labelledby="faq">
          <h2 id="faq" className="text-2xl font-bold text-brand-900 sm:text-3xl">
            Questions fréquentes
          </h2>
          <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white">
            {FAQ.map((item) => (
              <details key={item.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                  {item.q}
                  <span aria-hidden="true" className="text-brand-700 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
