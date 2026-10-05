"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Lens } from "@/data/projects";

// The "lens" is the site's adaptive feature: visitors choose a focus (AI, Data, Full-stack)
// and the site reorders and highlights the matching projects and skills. It is remembered
// in localStorage but never required, and the default (all) is a complete page.

export type LensValue = Lens | "all";
const KEY = "tm-lens";
const VALID: LensValue[] = ["all", "ai", "data", "fullstack"];

const Ctx = createContext<{ lens: LensValue; setLens: (l: LensValue) => void }>({
  lens: "all",
  setLens: () => {},
});

export function LensProvider({ children }: { children: React.ReactNode }) {
  const [lens, setLensState] = useState<LensValue>("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as LensValue | null;
      if (saved && VALID.includes(saved)) setLensState(saved);
    } catch {
      /* storage unavailable: stay on default */
    }
  }, []);

  const setLens = useCallback((l: LensValue) => {
    setLensState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  return <Ctx.Provider value={{ lens, setLens }}>{children}</Ctx.Provider>;
}

export const useLens = () => useContext(Ctx);
