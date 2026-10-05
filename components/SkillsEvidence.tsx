import Link from "next/link";
import { getProject } from "@/data/projects";
import { skillGroups } from "@/data/skills";

// Skills are claims; each one either links to the project that backs it or says plainly
// that no project is linked yet. No percentage bars.
export function SkillsEvidence() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {skillGroups.map((g) => (
        <section key={g.area} className="rounded-xl border border-border/50 bg-gradient-card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">{g.area}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{g.note}</p>
          <ul className="mt-4 space-y-3">
            {g.skills.map((s) => (
              <li key={s.name} className="text-sm">
                <span className="font-medium">{s.name}</span>
                <span className="block text-muted-foreground">
                  {s.evidence.length === 0 ? (
                    "Coursework / learning. No project linked yet."
                  ) : (
                    <>
                      Used in{" "}
                      {s.evidence.map((slug, i) => {
                        const p = getProject(slug);
                        return p ? (
                          <span key={slug}>
                            {i > 0 && ", "}
                            <Link className="text-primary underline-offset-4 hover:underline" href={`/projects/${slug}/`}>
                              {p.title}
                            </Link>
                          </span>
                        ) : null;
                      })}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
