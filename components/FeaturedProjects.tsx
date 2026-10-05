"use client";

import type { Project } from "@/data/projects";
import { useLens } from "./LensProvider";
import { ProjectCard } from "./ProjectCard";

// Adaptive ordering: projects that are evidence for the chosen lens float to the top.
// Ties keep the authored order, so the "all" view is exactly the order in projects.ts.
export function FeaturedProjects({ projects }: { projects: Project[] }) {
  const { lens } = useLens();
  const matches = (p: Project) => lens !== "all" && p.lenses.includes(lens);
  const sorted = [...projects].sort((a, b) => Number(matches(b)) - Number(matches(a)) || a.order - b.order);

  return (
    <ul className="grid gap-6 md:grid-cols-2">
      {sorted.map((p) => (
        <li key={p.slug} className="relative">
          <ProjectCard project={p} highlighted={matches(p)} />
        </li>
      ))}
    </ul>
  );
}
