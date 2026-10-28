/** Fuseau de référence de la plateforme (Kinshasa, UTC+1). */
export const PLATFORM_TIME_ZONE = "Africa/Kinshasa";

/** Date du jour au format AAAA-MM-JJ dans le fuseau donné. */
export function todayIso(timeZone = PLATFORM_TIME_ZONE, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** « lundi 2 novembre 2026 » */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("fr-CD", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** « 28/10/2026 à 14:05 » */
export function formatDateTime(iso: string, timeZone = PLATFORM_TIME_ZONE): string {
  return new Intl.DateTimeFormat("fr-CD", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(iso));
}
