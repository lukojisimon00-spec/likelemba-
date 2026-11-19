import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Alert, ButtonLink, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tokenSchema } from "@/lib/validation/invitation";
import { AcceptInvitationForm } from "./accept-form";

export const metadata: Metadata = { title: "Invitation", robots: { index: false, follow: false } };

const MESSAGES: Record<string, { tone: "error" | "warning" | "info"; text: string }> = {
  invalid: { tone: "error", text: "Ce lien d'invitation n'existe pas. Vérifiez que vous avez copié le lien en entier." },
  revoked: { tone: "warning", text: "Ce lien a été remplacé ou annulé par le responsable du groupe. Demandez-lui un nouveau lien." },
  expired: { tone: "warning", text: "Ce lien a expiré (14 jours). Demandez un nouveau lien au responsable du groupe." },
  accepted: { tone: "info", text: "Ce lien a déjà été utilisé." },
  unavailable: { tone: "warning", text: "Cette invitation n'est plus utilisable (groupe archivé ou membre retiré)." },
  already_member: { tone: "info", text: "Vous faites déjà partie de ce groupe." },
};

export default async function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  await requireUser(`/invitation/${token}`);

  type Preview = { group_name: string | null; member_name: string | null; manager_name: string | null; state: string };
  let preview: Preview | null = null;
  if (tokenSchema.safeParse(token).success) {
    const supabase = await createClient();
    const result = supabase ? await supabase.rpc("get_invitation_preview", { p_token: token }) : null;
    preview = ((result?.data ?? []) as Preview[])[0] ?? null;
  }
  const state = preview?.state ?? "invalid";

  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <Logo href="/tableau-de-bord" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
        <Card>
          <h1 className="text-2xl font-bold text-brand-900">Invitation</h1>
          {state === "valid" && preview ? (
            <>
              <p className="mt-3 text-ink">
                <strong>{preview.manager_name}</strong> vous invite à rejoindre le likelemba{" "}
                <strong>« {preview.group_name} »</strong>.
              </p>
              <p className="mt-2 text-sm text-muted">
                Vous apparaîtrez comme <strong>{preview.member_name}</strong>. Vous pourrez voir le calendrier des tours,
                les cotisations et qui a déjà reçu la cagnotte. Les autres membres verront votre nom et votre numéro.
              </p>
              <div className="mt-5">
                <AcceptInvitationForm token={token} />
              </div>
            </>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              <Alert tone={MESSAGES[state]?.tone ?? "error"}>{MESSAGES[state]?.text ?? MESSAGES.invalid.text}</Alert>
              <ButtonLink href="/groupes" variant="secondary">
                Voir mes groupes
              </ButtonLink>
            </div>
          )}
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
