"use client";

import { useEffect, useRef } from "react";

// Decorative backdrop: film grain, two fixed glows, and a soft spotlight that trails the
// mouse (fine pointers only). None of it carries information.
export function Ambient() {
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glow.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let x = 0, y = 0, tx = 0, ty = 0, raf = 0;
    const tick = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.transform = `translate(${x - 250}px, ${y - 250}px)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
    };
    const move = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      el.style.opacity = "1";
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const leave = () => (el.style.opacity = "0");
    window.addEventListener("mousemove", move);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("mousemove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden="true">
      <div className="film-grain" />
      <div className="pointer-events-none fixed -right-[100px] -top-[100px] z-[1] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(224,231,255,0.06)_0%,transparent_70%)]" />
      <div className="pointer-events-none fixed -bottom-[100px] -left-[100px] z-[1] h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(224,231,255,0.04)_0%,transparent_70%)]" />
      <div
        ref={glow}
        style={{ opacity: 0, left: 0, top: 0, transition: "opacity 0.3s" }}
        className="pointer-events-none fixed z-[10] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(224,231,255,0.07)_0%,transparent_70%)] will-change-transform"
      />
    </div>
  );
}
