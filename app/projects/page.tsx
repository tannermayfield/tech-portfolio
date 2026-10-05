import type { Metadata } from "next";
import { projects, smallWork } from "@/data/projects";
import { ProjectCard } from "@/components/ProjectCard";

export const metadata: Metadata = {
  title: "Projects",
  description: "Featured projects, explorations, and smaller academic work by Tanner Mayfield.",
};

export default function ProjectsPage() {
  const byTier = (t: string) => projects.filter((p) => p.tier === t).sort((a, b) => a.order - b.order);
  const groups = [
    { id: "featured", title: "Featured", items: byTier("featured") },
    { id: "exploring", title: "Exploring", items: byTier("exploring") },
    { id: "self", title: "This site", items: byTier("self") },
  ];

  return (
    <div className="container-page pb-8 pt-16 md:pt-20">
      <p className="eyebrow">Projects</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">Things I'm building and learning from</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Every project carries an honest status. Open one to see the problem, the decisions behind it, and what exists today versus what is planned.
      </p>

      {groups.map((g) => (
        <section key={g.id} aria-labelledby={g.id} className="mt-14">
          <h2 id={g.id} className="font-display text-2xl font-semibold">{g.title}</h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-2">
            {g.items.map((p) => (
              <li key={p.slug} className="relative">
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section aria-labelledby="small" className="mt-14">
        <h2 id="small" className="font-display text-2xl font-semibold">Smaller academic work</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {smallWork.map((s) => (
            <li key={s.title} className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.blurb}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
