import { profile } from "@/data/profile";
import { getProject, projects } from "@/data/projects";
import { skillGroups } from "@/data/skills";
import { ExperienceTabs } from "@/components/ExperienceTabs";
import { Connect } from "@/components/Connect";
import { FunPortfolio } from "@/components/FunPortfolio";
import { Hero } from "@/components/Hero";
import { ProjectsShowcase } from "@/components/ProjectsShowcase";
import { Reveal } from "@/components/Reveal";
import { SectionTitle } from "@/components/SectionTitle";

const sorted = [...projects].sort((a, b) => a.order - b.order);

// Skill chips carry their evidence in a tooltip: which projects use it, or that it is still coursework.
const evidenceTitle = (evidence: string[]) =>
  evidence.length === 0
    ? "Coursework / learning. No project linked yet."
    : `Used in ${evidence.map((s) => getProject(s)?.title ?? s).join(", ")}`;

export default function Home() {
  return (
    <>
      <Hero />

      <section id="about" aria-label="About" className="mx-auto min-w-0 max-w-6xl px-0 py-12 sm:py-16 lg:px-6 lg:pt-16 lg:pb-24">
        <SectionTitle>About me</SectionTitle>

        <div className="mb-12 flex flex-col items-center justify-between gap-10 sm:mb-16 sm:gap-12 md:flex-row-reverse md:items-start lg:mb-24 lg:gap-16">
          <Reveal className="flex justify-center md:w-2/5">
            <div className="group relative">
              <div
                aria-hidden="true"
                className="absolute -inset-3 rounded-2xl border border-moonstone/20 transition-all duration-500 group-hover:border-moonstone group-hover:shadow-[0_10px_25px_-5px_rgba(224,231,255,0.25),0_8px_10px_-6px_rgba(0,0,0,0.1)]"
              />
              {profile.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photo}
                  alt={profile.name}
                  className="relative z-10 h-56 w-56 rounded-xl object-cover object-[center_14%] shadow-2xl grayscale transition-all duration-700 hover:grayscale-0 sm:h-64 sm:w-64 md:h-80 md:w-80"
                />
              ) : (
                <div
                  role="img"
                  aria-label={`${profile.name} (photo coming soon)`}
                  className="relative z-10 flex h-56 w-56 items-center justify-center rounded-xl bg-[radial-gradient(circle_at_30%_20%,rgba(224,231,255,0.14),rgba(224,231,255,0.03)_60%)] shadow-2xl sm:h-64 sm:w-64 md:h-80 md:w-80"
                >
                  <span className="font-poppins text-7xl font-bold tracking-tight text-moonstone/80 md:text-8xl">TM</span>
                </div>
              )}
            </div>
          </Reveal>

          <Reveal className="w-full min-w-0 space-y-5 sm:space-y-6 md:w-3/5 lg:space-y-8">
            <p className="break-words text-base leading-relaxed text-white sm:text-lg lg:text-xl">
              I’m an Information Systems student at Brigham Young University who enjoys using technology to solve real business and user
              problems. My interests span data and analytics, AI and machine learning, software development, cloud and data systems, and
              business automation.
            </p>
            <p className="break-words text-base leading-relaxed text-white sm:text-lg lg:text-xl">
              I’m especially interested in understanding how data moves through systems, how AI can improve workflows and decision-making,
              and how technology can make complex processes more efficient. Through coursework and personal projects, I’m building hands-on
              experience with Python, SQL, relational databases, analytics, AI-assisted development, and cloud technologies.
            </p>
            <p className="break-words text-base leading-relaxed text-white/90 sm:text-lg lg:text-xl">
              My background in teaching, leadership, and bilingual communication has also taught me how to understand individual needs,
              explain complex ideas clearly, and work effectively with people—not just technology. Long term, I want to grow into a technology
              leader who can connect technical systems with the people and organizations they serve.
            </p>
          </Reveal>
        </div>

        <Reveal className="glass-card min-w-0 rounded-2xl p-6 sm:rounded-[2rem] sm:p-8 lg:p-10 xl:p-16">
          <h3 className="mb-8 text-2xl font-bold text-white sm:mb-10 sm:text-3xl lg:mb-12">My tech stack</h3>
          <div className="flex flex-col gap-6 sm:gap-8">
            {skillGroups.map((g) => (
              <div key={g.area} className="flex min-w-0 flex-col gap-3 sm:gap-4 md:flex-row md:items-start">
                <h4 className="shrink-0 break-words pt-0 text-xs font-bold uppercase tracking-[0.2em] text-[#aaa] sm:tracking-[0.3em] md:w-56 md:pt-2">
                  {g.area}
                </h4>
                <ul className="flex flex-wrap gap-3">
                  {g.skills.map((s) => (
                    <li
                      key={s.name}
                      title={evidenceTitle(s.evidence)}
                      className="relative cursor-default rounded-lg border border-moonstone-border/10 bg-moonstone-dim px-4 py-2 text-sm font-medium text-moonstone transition-colors duration-300"
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <ProjectsShowcase projects={sorted} />

      <section id="experience" aria-label="Experience" className="mx-auto min-w-0 max-w-6xl px-0 py-12 sm:py-16 lg:px-6 lg:pt-16 lg:pb-24">
        <SectionTitle>Experience</SectionTitle>
        <ExperienceTabs />
      </section>

      <FunPortfolio />
      <Connect />
    </>
  );
}
