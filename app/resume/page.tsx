import type { Metadata } from "next";
import { education, other, profile, roles } from "@/data/profile";
import { projects } from "@/data/projects";
import { skillGroups } from "@/data/skills";

export const metadata: Metadata = {
  title: "Resume",
  description: "Tanner Mayfield's education, work and volunteer experience, and projects.",
};

const experienceRoles = roles.filter((role) => role.kind === "work" || role.kind === "volunteer");
const projectRoles = roles.filter((role) => role.kind === "project");
const orderedProjects = [...projects].sort((a, b) => a.order - b.order);
const featuredProjects = orderedProjects.slice(0, 3);
const additionalProjects = orderedProjects.slice(3).map((project) => ({
    id: project.slug,
    title: project.title,
    status: project.status,
    description: project.tagline,
    detail: project.card.built,
    stack: project.stack,
}));

const heading = "mb-6 border-b border-white/10 pb-4 text-lg font-bold uppercase tracking-[0.2em] text-[#aaa] sm:text-xl sm:tracking-[0.3em]";
const card = "rounded-2xl border border-white/10 bg-moonstone-dim p-5 backdrop-blur-sm sm:p-6";
const eyebrow = "font-mono text-xs uppercase tracking-[0.2em] text-white/40";

export default function Resume() {
  return (
    <div className="mx-auto min-w-0 max-w-4xl px-0 pb-8 pt-16 lg:px-6 lg:pt-20">
      <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">Resume</h1>
      <p className="mt-3 text-lg text-white/60">Education, work and volunteer experience, and selected projects.</p>
      <a
        href={profile.links.resume}
        download="Tanner_Mayfield_IS_Resume.docx"
        className="btn-shine mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-moonstone-border bg-transparent px-8 py-3 text-base font-bold text-moonstone hover:bg-white"
      >
        Download CV
      </a>

      <section aria-labelledby="edu" className="mt-16">
        <h2 id="edu" className={heading}>Education</h2>
        <div className={card}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xl font-bold text-white">{education.school}</h3>
            <span className="font-mono text-sm text-moonstone">{education.date}</span>
          </div>
          <p className="text-white/60">{education.unit}</p>
          <p className="mt-2 font-medium text-white">{education.degree}</p>
          <p className="text-sm text-white/60">Minor in {education.minor} · Seeking {education.seeking}</p>
          <ul className="mt-4 space-y-1 text-sm text-white/80">
            <li>Major GPA: {education.majorGpa}</li>
            <li>Member, {education.involvement.join(", ")}</li>
          </ul>
          <div className="mt-4 grid gap-4 text-sm text-white/80 sm:grid-cols-2">
            <div>
              <p className={eyebrow}>Current courses</p>
              <p className="mt-1">{education.courses.current.join(" · ")}</p>
            </div>
            <div>
              <p className={eyebrow}>Upcoming · {education.courses.upcomingTerm}</p>
              <p className="mt-1">{education.courses.upcoming.join(" · ")}</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="skills" className="mt-16">
        <h2 id="skills" className={heading}>Technical Skills</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {skillGroups.map((group) => (
            <div key={group.area} className={card}>
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white">{group.area}</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {group.skills.map((skill) => (
                  <li key={skill.name} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/70">
                    {skill.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="exp" className="mt-16">
        <h2 id="exp" className={heading}>Experience</h2>
        <ol className="space-y-5">
          {experienceRoles.map((r) => (
            <li key={r.title + r.org} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold text-white">
                  {r.title} <span className="font-normal text-white/60">· {r.org}</span>
                </h3>
                <span className="font-mono text-sm text-moonstone">{r.dates}</span>
              </div>
              <p className={`${eyebrow} mt-1`}>
                {r.kind === "volunteer" ? "Volunteer" : "Work"}
                {r.place ? ` · ${r.place}` : ""}
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-white/80 marker:text-moonstone">
                {r.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="projects" className="mt-16">
        <h2 id="projects" className={heading}>Projects</h2>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-moonstone">Featured projects</h3>
        <ol className="grid gap-5">
          {featuredProjects.map((project, index) => {
            const projectRole = projectRoles.find((role) => role.projectSlug === project.slug);
            return (
              <li key={project.slug} className={`${card} ${index === 0 ? "border-moonstone/40" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={eyebrow}>Featured project · 0{index + 1}</span>
                  <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] text-moonstone">{project.status}</span>
                </div>
                <h4 className="mt-3 text-xl font-bold text-white">{project.title}</h4>
                <p className="mt-1 text-white/70">{project.tagline}</p>
                <p className="mt-3 text-sm text-white/80">{project.card.built}</p>
                {projectRole && (
                  <>
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-moonstone">{projectRole.title}</p>
                      <span className="font-mono text-xs text-white/50">{projectRole.dates}</span>
                    </div>
                    <ul aria-label={`${project.title} contributions`} className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/80 marker:text-moonstone">
                      {projectRole.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  </>
                )}
                {project.stack.length > 0 && (
                  <ul aria-label={`${project.title} tools`} className="mt-4 flex flex-wrap gap-2">
                    {project.stack.map((tool) => (
                      <li key={tool} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60">{tool}</li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <h3 className="mb-4 mt-8 text-sm font-bold uppercase tracking-[0.2em] text-white/60">More projects</h3>
        <ul className="grid gap-4 sm:grid-cols-2">
          {additionalProjects.map((project) => (
            <li key={project.id} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-bold text-white">{project.title}</h4>
                {project.status && <span className="font-mono text-[11px] text-moonstone">{project.status}</span>}
              </div>
              <p className="mt-1 text-sm text-white/70">{project.description}</p>
              {project.detail && <p className="mt-2 text-sm text-white/80">{project.detail}</p>}
              {project.stack.length > 0 && <p className="mt-3 text-xs text-white/50">{project.stack.join(" · ")}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="more" className="mt-16">
        <h2 id="more" className={heading}>Beyond code</h2>
        <dl className="grid gap-4 text-sm text-white/80 sm:grid-cols-3">
          <div><dt className={eyebrow}>Languages</dt><dd className="mt-1">{other.languages}</dd></div>
          <div><dt className={eyebrow}>Music</dt><dd className="mt-1">{other.music}</dd></div>
          <div><dt className={eyebrow}>Sports</dt><dd className="mt-1">{other.interests}</dd></div>
        </dl>
      </section>
    </div>
  );
}
