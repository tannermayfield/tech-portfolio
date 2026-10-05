"use client";

import { lensInfo } from "@/data/projects";
import { type LensValue, useLens } from "./LensProvider";

const order: LensValue[] = ["all", "ai", "data", "fullstack"];

export function LensPicker() {
  const { lens, setLens } = useLens();
  return (
    <div role="group" aria-labelledby="lens-label" className="flex flex-col gap-3">
      <p id="lens-label" className="eyebrow">
        Show me through a lens
      </p>
      <div className="flex flex-wrap gap-2">
        {order.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lens === l}
            onClick={() => setLens(l)}
            className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
              lens === l
                ? "border-sea bg-sea text-bg"
                : "border-line bg-surface text-ink hover:border-sea"
            }`}
          >
            {lensInfo[l].label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {lensInfo[lens].blurb}
      </p>
    </div>
  );
}
