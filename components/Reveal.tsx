"use client";

import { useEffect, useRef } from "react";
import { observeViewport } from "@/lib/observeViewport";

// Content is visible by default; the observer only adds an entrance animation.
// Missing hydration or observer callbacks must never hide the section.
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let revealed = false;
    let animation: Animation | undefined;
    const stop = observeViewport(() => {
      if (revealed || el.getClientRects().length === 0) return;
      const rect = el.getBoundingClientRect();
      // Any visible part is sufficient, including blocks taller than the screen
      // and the footer at the very end of the page.
      if (rect.top >= window.innerHeight || rect.bottom <= 0) return;
      revealed = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !el.animate) return;
      animation = el.animate(
        [{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }],
        { duration: 700, delay, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" },
      );
    }, el);
    return () => {
      stop();
      animation?.cancel();
    };
  }, [delay]);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
