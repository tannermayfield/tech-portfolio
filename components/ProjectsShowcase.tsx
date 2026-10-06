"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { lensInfo, type Project } from "@/data/projects";
import { Icon } from "./Icon";
import { ProjectPreview } from "./ProjectPreview";

const pad = (n: number) => String(n).padStart(2, "0");
const tag =
  "cursor-default rounded-full border border-white/20 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-white/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-white/5";
const pill =
  "flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 backdrop-blur-md";
const pillLabel = "text-[10px] font-bold uppercase tracking-[0.2em]";

const tagsFor = (p: Project) => [p.status, ...(p.stack.length ? p.stack : p.lenses.map((l) => lensInfo[l].label))];

// Desktop: the left column is sticky and swaps as the previews scroll past on the right.
// Mobile: a simple stacked list. Links (case study, GitHub, demo) are real anchors in both.
export function ProjectsShowcase({ projects }: { projects: Project[] }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const n = projects.length;

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = track.current;
      if (!el || el.offsetParent === null) return; // hidden below lg
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      const next = Math.round(p * (n - 1));
      setIndex((cur) => (cur === next ? cur : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [n]);

  const cur = projects[index];

  return (
    <section
      id="projects"
      aria-label="Projects"
      className="mx-auto min-w-0 max-w-6xl px-0 py-12 sm:py-16 lg:px-6 lg:py-0"
      style={{ overflowX: "clip", overflowY: "visible" }}
    >
      {/* Desktop */}
      <div className="hidden lg:flex" style={{ alignItems: "flex-start" }}>
        <div className="relative flex w-[45%] flex-col" style={{ position: "sticky", top: 0, height: "100svh" }}>
          <div className="absolute left-0 right-0 top-0 z-10 border-b border-white/10 pb-4 pt-16">
            <div className="flex items-center justify-between pr-8">
              <h2 className="font-poppins text-xl font-bold uppercase tracking-[0.3em] text-[#aaa] md:text-2xl">Projects</h2>
              <span className="font-mono text-xs uppercase tracking-widest text-white/30">/ Selected work</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-center pr-12">
            <div className="mb-3 flex items-center font-mono text-sm tracking-[0.3em] text-white/40" aria-live="polite">
              <span>[</span>
              <span className="px-3">{pad(index + 1)}</span>
              <span>/</span>
              <span className="px-3">{pad(n)}</span>
              <span>]</span>
            </div>
            <div key={cur.slug} className="swap">
              <h3 className="mb-4 max-w-[90%] break-words text-2xl font-bold uppercase leading-tight tracking-tight text-white xl:text-3xl">{cur.title}</h3>
              <p className="mb-3 max-w-[90%] text-sm leading-relaxed text-white/60">{cur.tagline}</p>
              <p className="mb-6 max-w-[90%] text-sm leading-relaxed text-white/40">{cur.card.built}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {tagsFor(cur).map((t) => (
                  <span key={t} className={tag}>{t}</span>
                ))}
              </div>
              <Link
                href={`/projects/${cur.slug}/`}
                className="mt-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-moonstone transition-colors hover:text-white"
              >
                Case study <Icon name="arrow-right" size={14} />
              </Link>
            </div>
          </div>
        </div>

        <div ref={track} className="w-[55%]">
          {projects.map((p) => (
            <div key={p.slug} className="flex items-center justify-end px-8" style={{ minHeight: "100svh" }}>
              <div className="relative w-full max-w-full">
                <div aria-hidden="true" className="absolute -inset-3 rounded-2xl border border-moonstone/20" />
                <div className="relative z-10 flex w-full items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-zinc-900/20 shadow-2xl backdrop-blur-3xl">
                  <ProjectPreview project={p} />
                  <div className="absolute inset-0 z-30 flex items-center justify-center gap-3 bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 focus-within:opacity-100 hover:opacity-100">
                    <Link href={`/projects/${p.slug}/`} className={`${pill} translate-y-2 transition-transform duration-300 hover:translate-y-0 focus-visible:translate-y-0`}>
                      <Icon name="arrow-right" size={18} className="text-white" />
                      <span className={`${pillLabel} text-white`}>Case study</span>
                    </Link>
                    {p.links.github && (
                      <a href={p.links.github} target="_blank" rel="noopener noreferrer" className={`${pill} translate-y-2 transition-transform duration-300 hover:translate-y-0 focus-visible:translate-y-0`}>
                        <Icon name="github" size={18} className="text-white" />
                        <span className={`${pillLabel} text-white`}>GitHub</span>
                      </a>
                    )}
                    {p.links.demo && (
                      <a href={p.links.demo} target="_blank" rel="noopener noreferrer" className={`${pill} translate-y-2 transition-transform duration-300 hover:translate-y-0 focus-visible:translate-y-0`}>
                        <span className={`${pillLabel} text-white`}>Live</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile */}
      <div className="flex w-full min-w-0 flex-col items-center text-center lg:hidden">
        <div className="w-full border-b border-white/10 pb-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h2 className="font-poppins truncate text-lg font-bold uppercase tracking-[0.2em] text-[#aaa] sm:text-xl sm:tracking-[0.3em]">Projects</h2>
            <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-white/30 sm:text-xs">/ Selected work</span>
          </div>
        </div>
        <div className="flex w-full flex-col items-center gap-12 pt-10 sm:gap-16 sm:pt-12">
          {projects.map((p, i) => (
            <article key={p.slug} className="mx-auto flex w-full min-w-0 max-w-lg flex-col items-center gap-5 sm:gap-6">
              <div className="flex flex-col items-center gap-3 sm:gap-4">
                <div className="font-mono text-xs tracking-[0.2em] text-white/40 sm:tracking-[0.3em]">
                  [ {pad(i + 1)} / {pad(n)} ]
                </div>
                <h3 className="break-words text-xl font-bold uppercase leading-snug tracking-tight text-white sm:text-2xl">{p.title}</h3>
              </div>
              <div className="relative mx-auto w-full min-w-0 max-w-full">
                <div aria-hidden="true" className="pointer-events-none absolute -inset-1.5 rounded-xl border border-moonstone/10 sm:-inset-2" />
                <div className="relative z-10 w-full overflow-hidden rounded-lg border border-white/5 bg-zinc-900/20 shadow-xl backdrop-blur-3xl">
                  <ProjectPreview project={p} />
                </div>
              </div>
              <p className="break-words text-sm leading-relaxed text-white/60 sm:text-base">{p.tagline}</p>
              <p className="break-words text-sm leading-relaxed text-white/40">{p.card.built}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {tagsFor(p).map((t) => (
                  <span key={t} className={`${tag} py-1.5`}>{t}</span>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-1">
                <Link href={`/projects/${p.slug}/`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-white/80 transition-colors duration-300 hover:bg-white/15 hover:text-white">
                  <span className={pillLabel}>Case study</span>
                </Link>
                {p.links.github && (
                  <a href={p.links.github} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-white/80 transition-colors duration-300 hover:bg-white/15 hover:text-white">
                    <Icon name="github" size={18} />
                    <span className={pillLabel}>GitHub</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
