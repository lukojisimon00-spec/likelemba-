/**
 * Numéros de téléphone mobiles en RDC.
 *
 * Format enregistré : +243 suivi de 9 chiffres commençant par 8 ou 9
 * (ex. +243812345678). Même règle que le domaine SQL `drc_phone`.
 *
 * Formats acceptés à la saisie : 0812345678, 812345678, 243812345678,
 * +243 81 234 5678, 00243812345678 (espaces, points et tirets ignorés).
 */

const E164_DRC = /^\+243[89]\d{8}$/;

export function normalizeDrcPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s.\-()]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;

  let national: string;
  if (compact.startsWith("+243")) national = compact.slice(4);
  else if (compact.startsWith("00243")) national = compact.slice(5);
  else if (compact.startsWith("243") && compact.length === 12) national = compact.slice(3);
  else if (compact.startsWith("0") && compact.length === 10) national = compact.slice(1);
  else if (compact.length === 9) national = compact;
  else return null;

  const e164 = `+243${national}`;
  return E164_DRC.test(e164) ? e164 : null;
}

export function isValidDrcPhone(input: string): boolean {
  return normalizeDrcPhone(input) !== null;
}

/** Affichage lisible : +243 81 234 5678 */
export function formatDrcPhone(e164: string): string {
  if (!E164_DRC.test(e164)) return e164;
  const n = e164.slice(4);
  return `+243 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}
