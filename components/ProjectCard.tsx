import Link from "next/link";
import type { Project } from "@/data/projects";
import { StatusBadge } from "./StatusBadge";

export function ProjectCard({ project, highlighted = false }: { project: Project; highlighted?: boolean }) {
  const { card } = project;
  return (
    <article
      className={`flex h-full flex-col rounded-2xl border bg-surface p-6 shadow-card transition-colors ${
        highlighted ? "border-sea" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-2xl font-semibold tracking-tight">
          <Link href={`/projects/${project.slug}/`} className="after:absolute after:inset-0 relative">
            {project.title}
          </Link>
        </h3>
        <StatusBadge status={project.status} confirmed={project.statusConfirmed} />
      </div>
      <p className="mt-2 text-muted">{project.tagline}</p>

      <dl className="mt-5 space-y-3 text-sm">
        <div>
          <dt className="eyebrow">Problem</dt>
          <dd>{card.problem}</dd>
        </div>
        <div>
          <dt className="eyebrow">Where it stands</dt>
          <dd>{card.built}</dd>
        </div>
        {card.learned && (
          <div>
            <dt className="eyebrow">What I learned</dt>
            <dd>{card.learned}</dd>
          </div>
        )}
      </dl>

      <div className="mt-auto pt-5">
        {project.stack.length > 0 && (
          <ul className="mb-4 flex flex-wrap gap-2" aria-label="Technologies">
            {project.stack.map((t) => (
              <li key={t} className="rounded-md bg-sunk px-2 py-1 font-mono text-xs text-muted">
                {t}
              </li>
            ))}
          </ul>
        )}
        <div className="relative z-10 flex items-center gap-4 text-sm">
          <span className="font-medium text-sea">Read the case study →</span>
          {project.links.github && (
            <a className="text-muted underline-offset-4 hover:text-ink hover:underline" href={project.links.github}>
              GitHub
            </a>
          )}
          {project.links.demo && (
            <a className="text-muted underline-offset-4 hover:text-ink hover:underline" href={project.links.demo}>
              Live demo
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
