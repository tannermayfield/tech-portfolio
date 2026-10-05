import type { Metadata } from "next";
import { education, other, profile, roles } from "@/data/profile";

export const metadata: Metadata = {
  title: "About",
  description: "Tanner Mayfield: BYU Information Systems student, education, and experience.",
};

const kindLabel = { project: "Project", work: "Work", volunteer: "Volunteer" } as const;

export default function About() {
  return (
    <div className="container-page pb-8 pt-16 md:pt-20">
      <p className="eyebrow">About</p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl font-semibold tracking-tight md:text-5xl">
        I like understanding both the user's problem and how to build the solution.
      </h1>
      <div className="mt-6 max-w-2xl space-y-4 text-lg text-muted">
        <p>
          I'm an Information Systems student at BYU, focused on software engineering and AI. I build useful systems, and I'm
          especially interested in software that adapts to users, context, goals, and tasks.
        </p>
        <p>
          My coursework spans product management, database design, programming, and IT infrastructure, so I think about the user,
          the data, the implementation, and the reason a feature should exist.
        </p>
      </div>

      <section aria-labelledby="edu" className="mt-16">
        <h2 id="edu" className="font-display text-2xl font-semibold">Education</h2>
        <div className="mt-5 rounded-2xl border border-line bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-xl font-semibold">{education.school}</h3>
            <span className="font-mono text-sm text-muted">{education.date}</span>
          </div>
          <p className="text-muted">{education.unit}</p>
          <p className="mt-2 font-medium">{education.degree}</p>
          <p className="text-sm text-muted">{education.focus}</p>
          <ul className="mt-4 space-y-1 text-sm">
            <li>Major GPA: {education.majorGpa}</li>
            <li>Member, {education.involvement.join(", ")}</li>
          </ul>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="eyebrow">Current courses</p>
              <p className="mt-1">{education.courses.current.join(" · ")}</p>
            </div>
            <div>
              <p className="eyebrow">Past courses</p>
              <p className="mt-1">{education.courses.past.join(" · ")}</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="exp" className="mt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="exp" className="font-display text-2xl font-semibold">Experience</h2>
          <a className="text-sm text-sea underline-offset-4 hover:underline" href={profile.links.resume}>
            Download resume (PDF)
          </a>
        </div>
        <ol className="mt-5 space-y-5">
          {roles.map((r) => (
            <li key={r.title + r.org} className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-semibold">
                  {r.title} <span className="font-sans text-base font-normal text-muted">· {r.org}</span>
                </h3>
                <span className="font-mono text-sm text-muted">{r.dates}</span>
              </div>
              <p className="eyebrow mt-1">
                {kindLabel[r.kind]}
                {r.place ? ` · ${r.place}` : ""}
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
                {r.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="more" className="mt-16">
        <h2 id="more" className="font-display text-2xl font-semibold">Beyond code</h2>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="eyebrow">Languages</dt><dd className="mt-1">{other.languages}</dd></div>
          <div><dt className="eyebrow">Music</dt><dd className="mt-1">{other.music}</dd></div>
          <div><dt className="eyebrow">Interests</dt><dd className="mt-1">{other.interests}</dd></div>
        </dl>
      </section>
    </div>
  );
}
