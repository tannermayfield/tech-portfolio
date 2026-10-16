import Link from "next/link";
import { CenteredScrollLink } from "./CenteredScrollLink";

const words = [
  "Data & Analytics",
  "AI & Machine Learning",
  "Software Development",
  "Cloud & Data Systems",
  "Business Automation",
];
const ticker = [...words, words[0]];

const btn =
  "btn-shine group inline-flex min-h-11 items-center justify-center rounded-full border border-moonstone-border bg-transparent px-6 py-3 text-base font-bold text-moonstone transition-all duration-300 hover:bg-white sm:px-8 sm:py-4 sm:text-lg lg:min-h-0";

export function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[80vh] flex-col items-center justify-center px-0 pb-12 pt-20 lg:h-screen lg:min-h-0 lg:px-6 lg:pb-0 lg:pt-0"
    >
      <p
        style={{ "--d": "0.3s" } as React.CSSProperties}
        className="rise absolute left-1/2 top-14 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2 font-mono text-[10px] font-medium tracking-[0.08em] text-white/70 shadow-[0_0_24px_rgba(74,222,128,0.06)] sm:top-16 sm:text-xs lg:top-8"
      >
        <span className="relative mr-[1ch] flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
        </span>
        Seeking Summer Internships and Co-ops
      </p>
      <div className="z-10 w-full min-w-0 max-w-2xl -translate-y-2 px-1 text-center lg:w-auto lg:max-w-none lg:-translate-y-4 lg:px-0">
        <p
          style={{ "--d": "0.5s" } as React.CSSProperties}
          className="rise mb-3 font-medium uppercase tracking-[0.15em] text-[#aaa] sm:mb-4 sm:text-base sm:tracking-[0.2em]"
        >
          Hello, I am
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
          <span className="opacity-80">Information Systems Student with experience in</span>
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
          <a href="#connect" className={btn}>
            Let&apos;s Connect
          </a>
          <Link href="/resume/" className={btn}>
            Resume
          </Link>
          <div className="hidden">
            <CenteredScrollLink targetId="fun" className="fun-outline-button inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 text-base font-bold text-white transition-transform duration-300 hover:-translate-y-0.5 sm:px-8 sm:py-4 sm:text-lg lg:min-h-0">
              Fun Portfolio
            </CenteredScrollLink>
          </div>
        </div>
      </div>

      <a
        href="#about"
        aria-label="Scroll to About"
        className="group absolute inset-x-0 bottom-6 mx-auto flex w-fit cursor-pointer flex-col items-center gap-2 text-center sm:bottom-10"
      >
        <span className="w-full text-center text-xs font-medium uppercase tracking-[0.3em] text-[#aaa] transition-colors group-hover:text-moonstone">Scroll</span>
        <span className="nudge mx-auto flex h-5 w-5 items-center justify-center text-moonstone">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </a>
    </section>
  );
}
