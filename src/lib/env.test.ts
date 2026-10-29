import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnv, safeRedirectPath } from "./env";

describe("safeRedirectPath", () => {
  it("accepte les chemins internes", () => {
    expect(safeRedirectPath("/profil")).toBe("/profil");
  });
  it.each(["//pirate.com", "https://pirate.com", "/\\pirate.com", "profil", undefined, 42])(
    "refuse %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/tableau-de-bord");
    },
  );
});

describe("getSupabaseEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("considère la valeur d'exemple comme non configurée", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_remplacez_moi");
    expect(getSupabaseEnv()).toBeNull();
  });

  it.each([
    ["adresse sans https://", "hmypvz.supabase.co", "sb_publishable_abc"],
    ["clé collée à la place de l'adresse", "sb_publishable_abc", "sb_publishable_abc"],
    ["clé avec un espace au milieu", "https://x.supabase.co", "sb_publishable abc"],
  ])("refuse une configuration invalide (%s)", (_label, url, key) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
    expect(getSupabaseEnv()).toBeNull();
  });

  it("nettoie les espaces et la barre finale", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "  https://x.supabase.co/ \n");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", " sb_publishable_abc\n");
    expect(getSupabaseEnv()).toEqual({ url: "https://x.supabase.co", key: "sb_publishable_abc" });
  });

  it("lit la configuration réelle", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_abc");
    expect(getSupabaseEnv()).toEqual({ url: "https://x.supabase.co", key: "sb_publishable_abc" });
  });
});
