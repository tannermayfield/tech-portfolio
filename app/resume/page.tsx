import type { Metadata } from "next";
import { education, other, profile, roles } from "@/data/profile";

export const metadata: Metadata = {
  title: "Resume",
  description: "Tanner Mayfield's education and experience.",
};

const kindLabel = { project: "Project", work: "Work", volunteer: "Volunteer" } as const;

export default function Resume() {
  return (
    <div className="px-6 pb-8 pt-32">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold md:text-5xl">
          <span className="text-gradient">Resume</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">Education and experience, as on my current resume.</p>
        <a
          href={profile.links.resume}
          className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground glow-primary hover:bg-primary/90"
        >
          Download PDF
        </a>

        <section aria-labelledby="edu" className="mt-14">
          <h2 id="edu" className="text-2xl font-bold">Education</h2>
          <div className="mt-5 rounded-xl border border-border/50 bg-gradient-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xl font-semibold">{education.school}</h3>
              <span className="font-mono text-sm text-muted-foreground">{education.date}</span>
            </div>
            <p className="text-muted-foreground">{education.unit}</p>
            <p className="mt-2 font-medium">{education.degree}</p>
            <p className="text-sm text-muted-foreground">{education.focus}</p>
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

        <section aria-labelledby="exp" className="mt-14">
          <h2 id="exp" className="text-2xl font-bold">Experience</h2>
          <ol className="mt-5 space-y-5">
            {roles.map((r) => (
              <li key={r.title + r.org} className="rounded-xl border border-border/50 bg-gradient-card p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">
                    {r.title} <span className="font-normal text-muted-foreground">· {r.org}</span>
                  </h3>
                  <span className="font-mono text-sm text-muted-foreground">{r.dates}</span>
                </div>
                <p className="eyebrow mt-1">
                  {kindLabel[r.kind]}
                  {r.place ? ` · ${r.place}` : ""}
                </p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {r.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="more" className="mt-14">
          <h2 id="more" className="text-2xl font-bold">Beyond code</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="eyebrow">Languages</dt><dd className="mt-1">{other.languages}</dd></div>
            <div><dt className="eyebrow">Music</dt><dd className="mt-1">{other.music}</dd></div>
            <div><dt className="eyebrow">Interests</dt><dd className="mt-1">{other.interests}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
