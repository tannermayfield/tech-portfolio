// A single quiet tide line, the only decorative motif on the site. Purely decorative.
export function Wave({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 40"
      preserveAspectRatio="none"
      className={`block h-6 w-full md:h-8 ${flip ? "rotate-180" : ""} ${className}`}
    >
      <path
        d="M0 20 C 100 4, 200 36, 300 20 S 500 4, 600 20 S 800 36, 900 20 S 1100 4, 1200 20 V40 H0 Z"
        fill="currentColor"
      />
    </svg>
  );
}
