"use client";

import { useState } from "react";
import { lensInfo, type Lens, type Project } from "@/data/projects";
import { ProjectCard } from "./ProjectCard";

// Filter pills (All / AI / Data / Full-stack) narrow the grid by which skill area a
// project is evidence for. This is the site's adaptive behavior: the work reshapes
// around what the visitor cares about.
type Filter = Lens | "all";
const filters: Filter[] = ["all", "ai", "data", "fullstack"];

export function ProjectsSection({ projects }: { projects: Project[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = projects.filter((p) => filter === "all" || p.lenses.includes(filter));

  return (
    <div>
      <div role="group" aria-label="Filter projects" className="flex flex-wrap justify-center gap-3">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`inline-flex h-10 items-center rounded-md px-4 text-sm font-medium transition-all duration-300 ${
              filter === f
                ? "bg-primary text-primary-foreground glow-primary"
                : "border border-border/50 bg-secondary/50 text-foreground backdrop-blur-sm hover:bg-secondary/80"
            }`}
          >
            {lensInfo[f].label}
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground" aria-live="polite">
        {lensInfo[filter].blurb} Showing {shown.length} of {projects.length}.
      </p>

      <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => (
          <li key={p.slug} className={`relative ${i === 0 ? "md:col-span-2 md:row-span-2" : ""}`}>
            <ProjectCard project={p} large={i === 0} />
          </li>
        ))}
      </ul>
    </div>
  );
}
