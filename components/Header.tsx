import Link from "next/link";
import { profile } from "@/data/profile";
import { ThemeToggle } from "./ThemeToggle";

const nav = [
  { href: "/projects/", label: "Projects" },
  { href: "/about/", label: "About" },
  { href: "/contact/", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="whitespace-nowrap font-display text-base font-semibold tracking-tight sm:text-lg">
          {profile.name}
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:bg-sunk hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
