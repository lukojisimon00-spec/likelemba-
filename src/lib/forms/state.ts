/** État renvoyé par une action serveur à son formulaire. */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** Valeurs à réafficher (jamais les mots de passe). */
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

export function formValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}
