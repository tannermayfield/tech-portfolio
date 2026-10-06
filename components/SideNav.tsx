"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { profile } from "@/data/profile";

const items = [
  { name: "Home", id: "home" },
  { name: "About", id: "about" },
  { name: "Experience", id: "experience" },
  { name: "Projects", id: "projects" },
  { name: "Fun Side", id: "fun" },
];

// Fixed left rail on desktop, full-screen overlay menu on mobile. On the home page it
// scroll-spies the section under the middle of the viewport.
export function SideNav() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [active, setActive] = useState("home");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!onHome) return;
    const spy = () => {
      const mid = window.scrollY + window.innerHeight / 2;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (mid >= top && mid < top + el.offsetHeight) setActive(it.id);
      }
    };
    window.addEventListener("scroll", spy, { passive: true });
    const t = setTimeout(spy, 100);
    return () => {
      window.removeEventListener("scroll", spy);
      clearTimeout(t);
    };
  }, [onHome]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = (e: React.MouseEvent, id: string) => {
    setOpen(false);
    if (!onHome) return; // normal navigation to /#id
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setActive(id);
  };

  const isActive = (id: string) => onHome && active === id;

  return (
    <>
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-[80px] flex-col items-start justify-center pl-4 lg:flex xl:w-[120px] xl:pl-6">
        <nav aria-label="Primary" className="flex flex-col items-start space-y-4">
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/#${it.id}`}
              onClick={(e) => go(e, it.id)}
              aria-current={isActive(it.id) ? "location" : undefined}
              className={`group relative flex min-h-[44px] items-center whitespace-nowrap text-[13px] tracking-[0.2em] transition-colors duration-300 ${
                isActive(it.id) ? "text-white" : "text-[#aaa] hover:text-white"
              }`}
            >
              {it.name}
              <span
                aria-hidden="true"
                className={`absolute bottom-[-4px] left-0 h-[1px] w-full origin-left bg-white transition-transform duration-300 ease-out ${
                  isActive(it.id) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </Link>
          ))}
        </nav>
      </aside>

      <div className="pointer-events-none fixed left-0 top-0 z-50 flex w-full items-center justify-end px-4 py-3 sm:px-6 sm:py-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          className="pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center text-white"
        >
          <Icon name={open ? "close" : "menu"} size={24} />
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="menu-in fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black px-6 sm:gap-8 lg:hidden"
        >
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/#${it.id}`}
              onClick={(e) => go(e, it.id)}
              className={`flex min-h-11 items-center text-xl tracking-[0.2em] transition-colors duration-300 sm:text-2xl sm:tracking-[0.3em] ${
                isActive(it.id) ? "text-white" : "text-[#aaa]"
              }`}
            >
              {it.name}
            </Link>
          ))}
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-[#aaa] sm:mt-12 sm:gap-8">
            <a href={profile.links.linkedin} aria-label="LinkedIn" className="flex min-h-11 min-w-11 items-center justify-center hover:text-white">
              <Icon name="linkedin" />
            </a>
            <a href={profile.links.github} aria-label="GitHub" className="flex min-h-11 min-w-11 items-center justify-center hover:text-white">
              <Icon name="github" />
            </a>
            <a href={`mailto:${profile.links.email}`} aria-label="Email" className="flex min-h-11 min-w-11 items-center justify-center hover:text-white">
              <Icon name="mail" />
            </a>
          </div>
        </nav>
      )}
    </>
  );
}
