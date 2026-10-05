import Link from "next/link";
import { lensInfo, type Project } from "@/data/projects";
import { StatusBadge } from "./StatusBadge";

// `large` is the lead card: it spans two columns/rows on desktop and shows a decorative
// header panel (no fake screenshots; real ones can replace it later via `project.image`).
export function ProjectCard({ project, large = false }: { project: Project; large?: boolean }) {
  const { card } = project;
  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-gradient-card transition-all duration-500 hover:border-border hover:glow-primary ${
        large ? "md:col-span-2 md:row-span-2" : ""
      }`}
    >
      {large && (
        <div aria-hidden="true" className="relative hidden h-56 overflow-hidden border-b border-border/50 md:block lg:h-72">
          <div className="hero-backdrop absolute inset-0 opacity-70" />
          <span className="text-gradient absolute bottom-3 left-6 text-7xl font-bold tracking-tight opacity-60 lg:text-8xl">
            {project.title}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{project.lenses.map((l) => lensInfo[l].label).join(" · ")}</span>
          <span className="ml-auto">
            <StatusBadge status={project.status} confirmed={project.statusConfirmed} />
          </span>
        </div>

        <h3 className="mt-3 text-2xl font-bold">
          <Link href={`/projects/${project.slug}/`} className="relative after:absolute after:inset-0 after:content-['']">
            {project.title}
          </Link>
        </h3>
        <p className="mt-2 text-muted-foreground">{project.tagline}</p>

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="eyebrow">Problem</dt>
            <dd className="mt-0.5">{card.problem}</dd>
          </div>
          <div>
            <dt className="eyebrow">Where it stands</dt>
            <dd className="mt-0.5">{card.built}</dd>
          </div>
          {card.learned && (
            <div>
              <dt className="eyebrow">What I learned</dt>
              <dd className="mt-0.5">{card.learned}</dd>
            </div>
          )}
        </dl>

        <div className="mt-auto pt-5">
          {project.stack.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Technologies">
              {project.stack.map((t) => (
                <li key={t} className="rounded-md border border-border/50 bg-secondary/50 px-2 py-1 text-xs text-muted-foreground">
                  {t}
                </li>
              ))}
            </ul>
          )}
          <div className="relative z-10 flex items-center gap-4 text-sm">
            <span className="font-medium text-primary">Case study →</span>
            {project.links.github && (
              <a className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={project.links.github}>
                GitHub
              </a>
            )}
            {project.links.demo && (
              <a className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={project.links.demo}>
                Live demo
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
