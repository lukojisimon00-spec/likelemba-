import { describe, expect, it } from "vitest";
import { fieldErrors, signUpSchema } from "./auth";

const valid = {
  fullName: "  Maman Alice ",
  email: " Alice@Example.COM ",
  phone: "0812345678",
  password: "motdepasse",
  passwordConfirm: "motdepasse",
};

describe("signUpSchema", () => {
  it("nettoie et normalise les données", () => {
    const result = signUpSchema.parse(valid);
    expect(result.fullName).toBe("Maman Alice");
    expect(result.email).toBe("alice@example.com");
    expect(result.phone).toBe("+243812345678");
  });

  it("accepte un téléphone vide", () => {
    expect(signUpSchema.parse({ ...valid, phone: "" }).phone).toBeNull();
  });

  it("renvoie des messages en français par champ", () => {
    const result = signUpSchema.safeParse({ ...valid, phone: "123", password: "court", passwordConfirm: "autre" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.phone).toMatch(/Numéro invalide/);
      expect(errors.password).toMatch(/au moins 8/);
    }
  });

  it("vérifie la confirmation du mot de passe", () => {
    const result = signUpSchema.safeParse({ ...valid, passwordConfirm: "different1" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).passwordConfirm).toBeTruthy();
  });
});
