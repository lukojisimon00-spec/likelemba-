import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-center text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  secondary: "border border-brand-700 bg-white text-brand-700 hover:bg-brand-50",
  light: "bg-brand-100 text-brand-900 hover:bg-white",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "bg-red-700 text-white hover:bg-red-800",
} as const;

export type ButtonVariant = keyof typeof variants;

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>{children}</div>;
}

const alertStyles = {
  error: "border-red-200 bg-red-50 text-red-900",
  success: "border-brand-200 bg-brand-50 text-brand-900",
  info: "border-line bg-white text-ink",
  warning: "border-amber-200 bg-gold-100 text-amber-950",
} as const;

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof alertStyles;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border p-4 text-sm leading-relaxed ${alertStyles[tone]}`}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

type FieldProps = ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
};

/** Champ de formulaire avec libellé, aide et message d'erreur accessibles. */
export function Field({ label, name, hint, error, className = "", ...input }: FieldProps) {
  const id = input.id ?? `champ-${name}`;
  const describedBy = [hint && `${id}-aide`, error && `${id}-erreur`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-12 rounded-xl border bg-white px-4 text-base text-ink placeholder:text-muted/70 ${
          error ? "border-red-600" : "border-line"
        } focus:border-brand-600`}
        {...input}
      />
      {hint && !error && (
        <p id={`${id}-aide`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-erreur`} className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function SimulationBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-gold-100 px-3 py-1 text-xs font-bold tracking-wide text-gold-600 uppercase ${className}`}
    >
      Simulation — aucun argent réel
    </span>
  );
}
