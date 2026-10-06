import { profile } from "@/data/profile";
import { Icon } from "./Icon";
import { Reveal } from "./Reveal";
import { SectionTitle } from "./SectionTitle";

const headline = "LET'S PLAY";

const btn =
  "btn-shine group flex min-h-11 w-full items-center justify-center gap-3 rounded-2xl border border-moonstone-border bg-transparent px-8 py-4 text-base font-bold text-moonstone transition-all duration-300 hover:bg-white sm:w-auto sm:px-10 sm:py-5 sm:text-lg";

// Replaces the old contact section (contact info lives in the side rail). It points to a
// second, more playful portfolio that doesn't exist yet: until `profile.links.funPortfolio`
// is set, the button renders as a disabled "Coming soon" reminder instead of a dead link.
export function FunPortfolio() {
  const href = profile.links.funPortfolio;
  return (
    <section id="fun" aria-labelledby="fun-h" className="mx-auto min-w-0 max-w-6xl px-0 py-12 sm:py-16 lg:px-6 lg:py-24">
      <SectionTitle>Beyond the resume</SectionTitle>
      <Reveal className="min-w-0 text-center">
        <h3 id="fun-h" className="mb-6 px-2 text-xs font-bold uppercase tracking-[0.25em] text-[#aaa] sm:mb-8 sm:tracking-[0.4em]">
          Want to know me even deeper?
        </h3>

        {/* Letters lift on hover, like the reference's contact headline. */}
        <div className="group relative inline-block max-w-full">
          <div className="overflow-hidden px-1 py-3 sm:py-4">
            <p
              aria-hidden="true"
              className="select-none break-words font-[family-name:var(--font-inter)] text-4xl font-black leading-none text-white transition-all duration-700 group-hover:text-moonstone sm:text-5xl md:text-8xl"
            >
              {headline.split("").map((ch, i) => (
                <span
                  key={i}
                  style={{ transitionDelay: `${i * 25}ms` }}
                  className="inline-block transition-transform duration-500 ease-out group-hover:-translate-y-2"
                >
                  {ch === " " ? " " : ch}
                </span>
              ))}
            </p>
            <span className="sr-only">{headline}</span>
          </div>
          <div className="mx-auto mt-4 h-[2px] w-0 bg-gradient-to-r from-transparent via-moonstone to-transparent opacity-50 shadow-[0_0_20px_rgba(224,231,255,0.4)] transition-all duration-1000 group-hover:w-full group-hover:opacity-100" />
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
          A more fun, creative portfolio: Apple Music songs playing in the background, cool AI technologies, and a deeper look at who I
          am beyond the work.
        </p>

        <div className="mx-auto mt-8 flex max-w-md flex-col items-stretch justify-center gap-3 sm:mt-12 sm:max-w-none sm:flex-row sm:items-center sm:gap-6">
          {href ? (
            <a href={href} className={btn}>
              <Icon name="sparkles" />
              Explore the fun portfolio
            </a>
          ) : (
            <span
              role="link"
              aria-disabled="true"
              className="flex min-h-11 w-full cursor-not-allowed flex-col items-center justify-center gap-2 rounded-2xl sm:flex-row sm:gap-3 border border-dashed border-moonstone-border bg-moonstone-dim px-8 py-4 text-base font-bold text-moonstone/70 sm:w-auto sm:px-10 sm:py-5 sm:text-lg"
            >
              <span className="flex items-center gap-3">
                <Icon name="sparkles" />
                Explore the fun portfolio
              </span>
              <span className="whitespace-nowrap rounded-full border border-moonstone-border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-moonstone">
                Coming soon
              </span>
            </span>
          )}
        </div>
      </Reveal>
    </section>
  );
}
