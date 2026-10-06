"use client";

import { useState } from "react";
import { roles } from "@/data/profile";
import { Reveal } from "./Reveal";

const isCurrent = (dates: string) => dates.trim().endsWith("Present");

// Desktop: company list on the left, selected role on the right. Mobile: stacked cards.
export function ExperienceTabs() {
  const [active, setActive] = useState(0);
  const r = roles[active];

  return (
    <>
      <div className="flex flex-col gap-4 lg:hidden">
        {roles.map((role, i) => (
          <Reveal key={role.tab} delay={i * 100}>
            <div className="rounded-2xl border border-white/10 bg-moonstone-dim p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-moonstone/30">
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="min-w-0 break-words text-base font-bold leading-snug text-white">{role.tab}</span>
                <span className="mt-0.5 flex-shrink-0 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-normal text-white/70">
                  {role.dates}
                </span>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <p className="text-[13px] font-semibold tracking-[0.04em] text-moonstone">{role.title}</p>
                {isCurrent(role.dates) && (
                  <span className="hidden flex-shrink-0 items-center whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-emerald-400 md:inline-flex">
                    Current
                  </span>
                )}
              </div>
              <div className="mb-3 h-px bg-white/10" />
              <ul className="flex flex-col gap-2">
                {role.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[13px] leading-relaxed text-white">
                    <span aria-hidden="true" className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-moonstone" />
                    <span className="break-words">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="hidden lg:flex lg:gap-12 xl:gap-24">
        <div role="tablist" aria-label="Experience" aria-orientation="vertical" className="flex w-1/3 flex-col gap-3">
          {roles.map((role, i) => (
            <button
              key={role.tab}
              type="button"
              role="tab"
              id={`exp-tab-${i}`}
              aria-selected={active === i}
              aria-controls="exp-panel"
              onClick={() => setActive(i)}
              title={role.tab}
              className={`btn-shine truncate rounded-xl border px-6 py-4 text-left transition-all duration-300 ${
                active === i
                  ? "border-moonstone bg-moonstone font-bold text-zinc-950"
                  : "border-moonstone-border/20 bg-transparent text-white hover:bg-white"
              }`}
            >
              {role.tab}
            </button>
          ))}
        </div>
        <div id="exp-panel" role="tabpanel" aria-labelledby={`exp-tab-${active}`} className="min-h-[300px] w-2/3">
          <div key={active} className="swap space-y-4 sm:space-y-6">
            <h3 className="break-words text-xl font-bold leading-snug text-white sm:text-2xl">{r.title}</h3>
            <p className="-mt-2 text-sm text-white/60">
              {r.org}
              {r.place ? ` · ${r.place}` : ""}
            </p>
            <p className="font-mono text-sm text-moonstone">{r.dates}</p>
            <ul className="space-y-3 sm:space-y-4">
              {r.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-base leading-relaxed text-white sm:gap-4 sm:text-lg">
                  <span aria-hidden="true" className="mt-1.5 flex-shrink-0 text-moonstone">•</span>
                  <span className="break-words">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
