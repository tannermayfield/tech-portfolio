import Link from "next/link";
import { education, profile } from "@/data/profile";
import { projects, smallWork } from "@/data/projects";
import { ProjectsSection } from "@/components/ProjectsSection";
import { Reveal } from "@/components/Reveal";
import { SkillsEvidence } from "@/components/SkillsEvidence";
import { LinkIcon } from "@/components/LinkIcon";

const sorted = [...projects].sort((a, b) => a.order - b.order);

const approach = [
  ["Understand the user", "Interviews, problem validation, and PRDs decide what is worth building."],
  ["Model the data", "Relational design, ERDs, and SQL give the product a sound foundation."],
  ["Build full-stack", "JavaScript applications taken end to end, with AI-assisted workflows."],
  ["Ship and run it", "Git, deployment, and cloud fundamentals that keep it working."],
];

const chip =
  "inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/50 bg-secondary/50 px-5 text-sm text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-foreground";

function SectionHeading({ id, title, accent, blurb }: { id: string; title: string; accent: string; blurb?: string }) {
  return (
    <div className="text-center">
      <h2 id={id} className="text-4xl font-bold md:text-5xl">
        {title} <span className="text-gradient">{accent}</span>
      </h2>
      {blurb && <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{blurb}</p>}
    </div>
  );
}

export default function Home() {
  const { links } = profile;
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-28 text-center">
        <div aria-hidden="true" className="hero-backdrop absolute inset-0" />
        <div className="relative flex max-w-3xl flex-col items-center">
          <p className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/70 px-5 py-2.5 text-sm text-muted-foreground backdrop-blur">
            <span aria-hidden="true" className="pulse-dot h-2 w-2 rounded-full bg-primary" />
            Seeking <strong className="font-semibold text-foreground">software engineering</strong> and{" "}
            <strong className="font-semibold text-foreground">data analytics</strong> internships
          </p>

          <div
            aria-hidden="true"
            className="mt-10 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-primary text-4xl font-bold text-primary-foreground glow-primary"
          >
            TM
            {/* TODO(Tanner): replace the monogram with a real photo in /public and use next/image */}
          </div>

          <h1 className="mt-8 text-5xl font-bold leading-[1.05] md:text-7xl">
            Hi, I'm <span className="text-gradient">{profile.name}</span>
          </h1>
          <p className="mt-5 text-xl font-medium md:text-2xl">BYU Information Systems</p>
          <p className="mt-1 text-sm text-muted-foreground">{profile.descriptor}</p>

          <p className="mt-8 text-lg leading-relaxed text-muted-foreground md:text-xl">
            I build <strong className="font-semibold text-foreground">AI-assisted, full-stack software</strong>, and I'm drawn to
            software that{" "}
            <strong className="font-semibold text-foreground">adapts to people, context, and goals</strong>. I combine product
            thinking, database design, and AI automation to turn ideas into working systems.
          </p>

          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            <li><a className={chip} href={`mailto:${links.email}`}><LinkIcon name="email" />{links.email}</a></li>
            <li><a className={chip} href={links.github}><LinkIcon name="github" />github.com/tannermayfield</a></li>
            <li><a className={chip} href={links.linkedin}><LinkIcon name="linkedin" />LinkedIn</a></li>
          </ul>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#projects"
              className="inline-flex h-12 items-center rounded-md bg-primary px-8 font-medium text-primary-foreground transition-all hover:bg-primary/90 glow-primary"
            >
              View My Work
            </a>
            <a
              href="#contact"
              className="inline-flex h-12 items-center rounded-md border border-border/60 bg-secondary/50 px-8 font-medium backdrop-blur-sm transition-colors hover:bg-secondary/80"
            >
              Get In Touch
            </a>
          </div>
        </div>
      </section>

      {/* Projects */}
      <section id="projects" aria-labelledby="projects-h" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading
              id="projects-h"
              title="Featured"
              accent="Projects"
              blurb="Each project carries an honest status. Case studies separate what exists today from what is planned."
            />
          </Reveal>
          <Reveal className="mt-12">
            <ProjectsSection projects={sorted} />
          </Reveal>

          <Reveal className="mt-16">
            <h3 className="text-center text-xl font-bold">Smaller academic work</h3>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {smallWork.map((s) => (
                <li key={s.title} className="rounded-xl border border-border/50 bg-gradient-card p-5">
                  <h4 className="font-semibold">{s.title}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Skills */}
      <section id="skills" aria-labelledby="skills-h" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading
              id="skills-h"
              title="Skills,"
              accent="with evidence"
              blurb="No percentage bars. Each skill points to the project that uses it, or says plainly that it doesn't yet."
            />
          </Reveal>
          <Reveal className="mt-12">
            <SkillsEvidence />
          </Reveal>
        </div>
      </section>

      {/* About */}
      <section id="about" aria-labelledby="about-h" className="relative overflow-hidden px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <SectionHeading id="about-h" title="About" accent="Me" />
            <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted-foreground">
              <p>
                I'm an Information Systems student at BYU, focused on software engineering and AI. I like understanding both the
                user's problem and how to build the solution, so I think about the user, the data, the implementation, and the
                reason a feature should exist.
              </p>
              <p>
                Coursework in product management, database design, programming, and IT infrastructure sits alongside the things I
                build myself, mostly with AI agents in a spec-driven workflow. I'm especially interested in software that adapts to
                users, context, goals, and tasks.
              </p>
              <p>
                I also speak Spanish fluently, am studying Portuguese and ASL, and play piano, drums, and guitar.
              </p>
            </div>
            <ol className="mt-12 grid gap-6 sm:grid-cols-2">
              {approach.map(([title, text], i) => (
                <li key={title} className="border-t border-border/60 pt-4">
                  <span className="font-mono text-xs text-primary">0{i + 1}</span>
                  <h3 className="mt-1 font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-10 text-sm text-muted-foreground">
              {education.degree}, {education.school} · Major GPA {education.majorGpa}.{" "}
              <Link href="/resume/" className="text-primary underline-offset-4 hover:underline">
                Full resume →
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" aria-labelledby="contact-h" className="px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionHeading
            id="contact-h"
            title="Let's"
            accent="Connect"
            blurb="I'm looking for software engineering, AI, and full-stack internships. Email is the fastest way to reach me."
          />
          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            <li><a className={chip} href={`mailto:${links.email}`}><LinkIcon name="email" />{links.email}</a></li>
            <li><a className={chip} href={links.github}><LinkIcon name="github" />GitHub</a></li>
            <li><a className={chip} href={links.linkedin}><LinkIcon name="linkedin" />LinkedIn</a></li>
          </ul>
        </Reveal>
      </section>
    </>
  );
}
