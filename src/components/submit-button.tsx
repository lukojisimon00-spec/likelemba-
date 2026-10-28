"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./ui";

/** Bouton d'envoi qui se désactive et affiche un indicateur pendant le traitement. */
export function SubmitButton({
  children,
  pendingLabel = "Veuillez patienter…",
  variant = "primary",
  className = "w-full",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant, className)}>
      {pending && (
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      )}
      {pending ? pendingLabel : children}
    </button>
  );
}
