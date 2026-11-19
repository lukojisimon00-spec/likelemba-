import { z } from "zod";

/** Jeton d'invitation : 43 caractères base64url générés par la base (32 octets aléatoires). */
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,100}$/);
