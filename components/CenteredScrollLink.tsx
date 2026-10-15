"use client";

import type { MouseEvent, ReactNode } from "react";

export function CenteredScrollLink({
  targetId,
  className,
  children,
}: {
  targetId: string;
  className: string;
  children: ReactNode;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById(targetId);
    if (!target) return;

    window.history.pushState(null, "", `#${targetId}`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  };

  return (
    <a href={`#${targetId}`} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
