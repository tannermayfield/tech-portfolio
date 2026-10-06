import { profile } from "@/data/profile";

const words = ["AI", "PostgreSQL", "Node.js", "Adaptive Software"];
const ticker = [...words, words[0]];

const btn =
  "btn-shine group inline-flex min-h-11 items-center justify-center rounded-full border border-moonstone-border bg-transparent px-6 py-3 text-base font-bold text-moonstone transition-all duration-300 hover:bg-white sm:px-8 sm:py-4 sm:text-lg lg:min-h-0";

export function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[80vh] flex-col items-center justify-center px-0 pb-12 pt-20 lg:h-screen lg:min-h-0 lg:px-6 lg:pb-0 lg:pt-0"
    >
      <div className="z-10 w-full min-w-0 max-w-2xl px-1 text-center lg:w-auto lg:max-w-none lg:px-0">
        <p
          style={{ "--d": "0.5s" } as React.CSSProperties}
          className="rise mb-3 font-medium uppercase tracking-[0.15em] text-[#aaa] sm:mb-4 sm:text-base sm:tracking-[0.2em]"
        >
          Hello, this is
        </p>
        <h1
          style={{ "--d": "0.7s" } as React.CSSProperties}
          className="rise mb-4 break-words text-4xl font-bold leading-tight tracking-tight text-white sm:mb-6 sm:text-5xl md:text-8xl lg:break-normal lg:text-[length:clamp(5rem,9vw,8rem)] lg:leading-none"
        >
          Tanner Mayfield
        </h1>
        <p
          style={{ "--d": "0.9s" } as React.CSSProperties}
          className="rise mx-auto mb-8 flex max-w-2xl flex-col items-center gap-3 px-1 text-base leading-relaxed text-white sm:mb-12 sm:text-xl md:text-2xl lg:mb-12 lg:block lg:max-w-4xl lg:px-0 font-[family-name:var(--font-inter)]"
        >
          <span className="opacity-80">Aspiring Software Engineer Crafting with</span>
          <span className="sr-only">{words.slice(0, -1).join(", ")}, and {words[words.length - 1]}</span>
          <span
            aria-hidden="true"
            className="rounded border border-moonstone-border/20 bg-moonstone-dim px-3 py-1 font-mono font-semibold text-moonstone max-lg:mt-1 lg:ml-[0.5em]"
            style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}
          >
            <span style={{ display: "block", overflow: "hidden", height: "1.2em" }}>
              <span className="ticker" style={{ display: "flex", flexDirection: "column", animation: "tick 10s ease-in-out infinite" }}>
                {ticker.map((w, i) => (
                  <span key={i} style={{ display: "block", height: "1.2em", lineHeight: "1.2em", whiteSpace: "nowrap" }}>
                    {w}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </p>
        <div
          style={{ "--d": "1.1s" } as React.CSSProperties}
          className="rise mx-auto flex w-full max-w-md flex-col flex-wrap items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:gap-6"
        >
          <a href="#projects" className={btn}>
            View Work
          </a>
          <a href={profile.links.resume} target="_blank" rel="noopener noreferrer" className={btn}>
            Download CV
          </a>
        </div>
        <p
          style={{ "--d": "1.3s" } as React.CSSProperties}
          className="rise mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40 sm:text-xs"
        >
          BYU Information Systems · Seeking software engineering internships
        </p>
      </div>

      <a
        href="#about"
        aria-label="Scroll to About"
        className="group absolute bottom-6 left-1/2 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-2 sm:bottom-10"
      >
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-[#aaa] transition-colors group-hover:text-moonstone">Scroll</span>
        <span className="nudge text-moonstone">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </a>
    </section>
  );
}
