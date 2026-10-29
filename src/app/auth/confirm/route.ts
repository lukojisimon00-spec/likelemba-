import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Destination des liens envoyés par e-mail (confirmation d'inscription,
 * réinitialisation du mot de passe). Gère les deux formats de Supabase :
 * « ?code=… » (PKCE) et « ?token_hash=…&type=… ».
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("suite") ?? searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  if (supabase) {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
      // Lien ouvert dans un autre navigateur que celui de l'inscription : Supabase a déjà
      // vérifié l'adresse, seule la connexion automatique a échoué.
      return NextResponse.redirect(new URL("/connexion?erreur=autre-navigateur", origin));
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/connexion?erreur=lien", origin));
}
