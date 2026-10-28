import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg" aria-label="LIKELEMBA — accueil">
      <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#146B50" />
        <circle cx="32" cy="32" r="17" fill="none" stroke="#D4F0DF" strokeWidth="5" />
        <circle cx="32" cy="15" r="5" fill="#F6C453" />
        <path d="M26 24v16h12" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xl font-extrabold tracking-tight text-brand-700">LIKELEMBA</span>
    </Link>
  );
}
