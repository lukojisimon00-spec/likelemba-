import Link from "next/link";

/** Symbole LIKELEMBA : la cagnotte (pièce « L ») et la rotation des tours. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
      <linearGradient id="likelemba-logo-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#1A7D5E"/>
      <stop offset="1" stopColor="#0E3A2E"/>
      </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#likelemba-logo-g)"/>
      <path d="M35.65 11.32 A21 21 0 0 1 52.92 33.83" fill="none" stroke="#BDE8D3" strokeWidth="3.6" strokeLinecap="round"/>
      <path d="M57.36 29.33 L52.92 33.83 L48.41 30.28" fill="none" stroke="#BDE8D3" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M48.09 45.50 A21 21 0 0 1 19.95 49.20" fill="none" stroke="#BDE8D3" strokeWidth="3.6" strokeLinecap="round"/>
      <path d="M21.63 55.30 L19.95 49.20 L25.29 47.07" fill="none" stroke="#BDE8D3" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.27 39.18 A21 21 0 0 1 23.13 12.97" fill="none" stroke="#BDE8D3" strokeWidth="3.6" strokeLinecap="round"/>
      <path d="M17.01 11.37 L23.13 12.97 L22.30 18.65" fill="none" stroke="#BDE8D3" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="32" cy="32" r="12.5" fill="#F5BE3C"/>
      <circle cx="32" cy="32" r="9.6" fill="none" stroke="#D99A1E" strokeWidth="1.4"/>
      <path d="M29 26.5v11h7.5" fill="none" stroke="#0E3A2E" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg" aria-label="LIKELEMBA — accueil">
      <LogoMark />
      <span className="text-xl font-extrabold tracking-tight text-brand-700">LIKELEMBA</span>
    </Link>
  );
}
