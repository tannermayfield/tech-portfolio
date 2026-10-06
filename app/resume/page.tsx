import type { Metadata } from "next";
import { education, other, profile, roles } from "@/data/profile";
import { smallWork } from "@/data/projects";

export const metadata: Metadata = {
  title: "Resume",
  description: "Tanner Mayfield's education and experience.",
};

const kindLabel = { project: "Project", work: "Work", volunteer: "Volunteer" } as const;

const heading = "mb-6 border-b border-white/10 pb-4 text-lg font-bold uppercase tracking-[0.2em] text-[#aaa] sm:text-xl sm:tracking-[0.3em]";
const card = "rounded-2xl border border-white/10 bg-moonstone-dim p-5 backdrop-blur-sm sm:p-6";
const eyebrow = "font-mono text-xs uppercase tracking-[0.2em] text-white/40";

export default function Resume() {
  return (
    <div className="mx-auto min-w-0 max-w-4xl px-0 pb-8 pt-24 lg:px-6 lg:pt-32">
      <h1 className="text-4xl font-bold tracking-tight text-white md:text-6xl">Resume</h1>
      <p className="mt-3 text-lg text-white/60">Education and experience, as on my current resume.</p>
      <a
        href={profile.links.resume}
        target="_blank"
        rel="noopener noreferrer"
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
          <p className="text-sm text-white/60">{education.focus}</p>
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
              <p className={eyebrow}>Past courses</p>
              <p className="mt-1">{education.courses.past.join(" · ")}</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="exp" className="mt-16">
        <h2 id="exp" className={heading}>Experience</h2>
        <ol className="space-y-5">
          {roles.map((r) => (
            <li key={r.title + r.org} className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold text-white">
                  {r.title} <span className="font-normal text-white/60">· {r.org}</span>
                </h3>
                <span className="font-mono text-sm text-moonstone">{r.dates}</span>
              </div>
              <p className={`${eyebrow} mt-1`}>
                {kindLabel[r.kind]}
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

      <section aria-labelledby="academic" className="mt-16">
        <h2 id="academic" className={heading}>Smaller academic work</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {smallWork.map((s) => (
            <li key={s.title} className={card}>
              <h3 className="font-bold text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-white/60">{s.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="more" className="mt-16">
        <h2 id="more" className={heading}>Beyond code</h2>
        <dl className="grid gap-4 text-sm text-white/80 sm:grid-cols-3">
          <div><dt className={eyebrow}>Languages</dt><dd className="mt-1">{other.languages}</dd></div>
          <div><dt className={eyebrow}>Music</dt><dd className="mt-1">{other.music}</dd></div>
          <div><dt className={eyebrow}>Interests</dt><dd className="mt-1">{other.interests}</dd></div>
        </dl>
      </section>
    </div>
  );
}
