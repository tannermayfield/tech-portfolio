"use client";

import Link from "next/link";
import { getProject } from "@/data/projects";
import { skillGroups } from "@/data/skills";
import { useLens } from "./LensProvider";

// Skills are claims; each one either links to the project that backs it or says plainly
// that no project is linked yet.
export function SkillsEvidence() {
  const { lens } = useLens();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {skillGroups.map((g) => {
        const active = lens !== "all" && g.lens === lens;
        return (
          <section
            key={g.area}
            className={`rounded-2xl border bg-surface p-6 ${active ? "border-sea shadow-card" : "border-line"}`}
          >
            <h3 className="font-display text-xl font-semibold">{g.area}</h3>
            <p className="mt-1 text-sm text-muted">{g.note}</p>
            <ul className="mt-4 space-y-3">
              {g.skills.map((s) => (
                <li key={s.name} className="text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="block text-muted">
                    {s.evidence.length === 0 ? (
                      "Coursework / learning. No project linked yet."
                    ) : (
                      <>
                        Used in{" "}
                        {s.evidence.map((slug, i) => {
                          const p = getProject(slug);
                          return p ? (
                            <span key={slug}>
                              {i > 0 && ", "}
                              <Link className="text-sea underline-offset-4 hover:underline" href={`/projects/${slug}/`}>
                                {p.title}
                              </Link>
                            </span>
                          ) : null;
                        })}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
