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

  it("lit la configuration réelle", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_abc");
    expect(getSupabaseEnv()).toEqual({ url: "https://x.supabase.co", key: "sb_publishable_abc" });
  });
});
