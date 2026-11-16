import Link from "next/link";

export function Logo({ size = 18 }: { size?: number }) {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark" aria-hidden>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="13" width="4" height="7" rx="1.4" fill="currentColor" opacity=".6" />
          <rect x="10" y="9" width="4" height="11" rx="1.4" fill="currentColor" opacity=".85" />
          <rect x="16.5" y="4" width="4" height="16" rx="1.4" fill="currentColor" />
        </svg>
      </span>
      Fiscootto
    </Link>
  );
}
