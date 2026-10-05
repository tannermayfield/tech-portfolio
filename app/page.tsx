import Link from "next/link";
import { profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { FeaturedProjects } from "@/components/FeaturedProjects";
import { LensPicker } from "@/components/LensPicker";
import { SkillsEvidence } from "@/components/SkillsEvidence";
import { StatusBadge } from "@/components/StatusBadge";
import { Wave } from "@/components/Wave";

const featured = projects.filter((p) => p.tier === "featured").sort((a, b) => a.order - b.order);
const exploring = projects.filter((p) => p.tier === "exploring");

const approach = [
  ["Understand the user", "Interviews, problem validation, and PRDs decide what is worth building."],
  ["Model the data", "Relational design, ERDs, and SQL so the product has a sound foundation."],
  ["Build full-stack", "JavaScript applications taken end to end, with AI-assisted workflows."],
  ["Ship and run it", "Git, deployment, and cloud fundamentals that keep it working."],
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page pb-20 pt-16 md:pb-28 md:pt-24">
          <p className="rise eyebrow">
            Information Systems · Brigham Young University
          </p>
          <h1 className="rise rise-2 mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
            {profile.name}
            <span className="block text-sea">builds software that adapts to people, problems, and goals.</span>
          </h1>
          <p className="rise rise-3 mt-6 max-w-2xl text-lg text-muted">{profile.intro}</p>

          <div className="rise rise-3 mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/projects/"
              className="inline-flex min-h-11 items-center rounded-full bg-sea px-6 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              View projects
            </Link>
            <a
              href={profile.links.resume}
              className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-6 text-sm font-medium transition-colors hover:border-sea"
            >
              Resume (PDF)
            </a>
            <a
              href={profile.links.github}
              className="inline-flex min-h-11 items-center px-3 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              GitHub
            </a>
          </div>

          {/* The adaptive title is deliberately quiet: a small caption, not the headline. */}
          <p className="mt-10 font-mono text-xs text-muted">
            <span aria-hidden="true" className="mr-2 inline-block h-px w-6 bg-coral align-middle" />
            {profile.descriptor}
          </p>
        </div>
        <Wave className="text-foam" />
      </section>

      {/* Lens + featured projects */}
      <section aria-labelledby="featured" className="bg-foam/60 pb-20 pt-4 dark:bg-foam/30">
        <div className="container-page">
          <div className="flex flex-col gap-8 pt-12 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Featured work</p>
              <h2 id="featured" className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                What I'm building
              </h2>
              <p className="mt-3 max-w-xl text-muted">
                Each project is labeled with how real it is today. Case studies separate what exists from what is planned.
              </p>
            </div>
            <LensPicker />
          </div>
          <div className="mt-10">
            <FeaturedProjects projects={featured} />
          </div>

          {exploring.map((p) => (
            <Link
              key={p.slug}
              href={`/projects/${p.slug}/`}
              className="mt-6 flex flex-col gap-3 rounded-2xl border border-dashed border-line bg-surface p-6 transition-colors hover:border-sea sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="eyebrow">Exploring</p>
                <p className="mt-1 font-display text-xl font-semibold">{p.title}</p>
                <p className="text-sm text-muted">{p.card.problem}</p>
              </div>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </div>
      </section>

      {/* How I work */}
      <section aria-labelledby="approach" className="container-page pt-20">
        <p className="eyebrow">How I work</p>
        <h2 id="approach" className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight md:text-4xl">
          I don't just generate code. I start with the user and work down to the infrastructure.
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {approach.map(([title, text], i) => (
            <li key={title} className="border-t border-line pt-4">
              <span className="font-mono text-xs text-sea">0{i + 1}</span>
              <h3 className="mt-2 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Skills */}
      <section aria-labelledby="skills" className="container-page pt-20">
        <p className="eyebrow">Skills, with evidence</p>
        <h2 id="skills" className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Where each skill shows up
        </h2>
        <p className="mt-3 max-w-xl text-muted">No percentage bars. Each skill points to the project that uses it, or says plainly that it doesn't yet.</p>
        <div className="mt-10">
          <SkillsEvidence />
        </div>
      </section>

      {/* Contact CTA */}
      <section className="container-page pt-20">
        <div className="rounded-3xl bg-ink px-6 py-12 text-bg sm:px-12">
          <h2 className="font-display text-3xl font-semibold tracking-tight">Hiring for an internship?</h2>
          <p className="mt-3 max-w-xl opacity-80">
            I'd like to hear about it. Email is the fastest way to reach me.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`mailto:${profile.links.email}`}
              className="inline-flex min-h-11 items-center rounded-full bg-bg px-6 text-sm font-medium text-ink"
            >
              {profile.links.email}
            </a>
            <Link href="/contact/" className="inline-flex min-h-11 items-center rounded-full border border-bg/40 px-6 text-sm">
              Other ways to reach me
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
