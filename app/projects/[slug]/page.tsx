import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, projects } from "@/data/projects";
import { StatusBadge } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = getProject((await params).slug);
  return p ? { title: p.title, description: p.tagline } : {};
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/10 py-8">
      <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-[#aaa]">{title}</h2>
      <div className="mt-4 max-w-2xl space-y-3 text-base leading-relaxed text-white/80 sm:text-lg [&_strong]:text-white">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-2 pl-5 marker:text-moonstone">
    {items.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

export default async function CaseStudy({ params }: { params: Promise<Params> }) {
  const p = getProject((await params).slug);
  if (!p) notFound();
  const s = p.study;

  return (
    <article className="mx-auto min-w-0 max-w-4xl px-0 pb-8 pt-24 lg:px-6 lg:pt-32">
      <Link href="/#projects" className="font-mono text-xs uppercase tracking-[0.2em] text-[#aaa] transition-colors hover:text-white">
        ← Back to work
      </Link>
      <header className="mt-6">
        <StatusBadge status={p.status} confirmed={p.statusConfirmed} />
        <h1 className="mt-4 break-words text-4xl font-bold tracking-tight text-white md:text-6xl">{p.title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-white/60">{p.tagline}</p>
        {(p.links.github || p.links.demo) && (
          <p className="mt-5 flex flex-wrap gap-3 text-sm">
            {p.links.github && <a className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-xs font-bold uppercase tracking-[0.2em] text-white/80 transition-colors hover:bg-white/15 hover:text-white" href={p.links.github} target="_blank" rel="noopener noreferrer"><Icon name="github" size={18} />GitHub</a>}
            {p.links.demo && <a className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-xs font-bold uppercase tracking-[0.2em] text-white/80 transition-colors hover:bg-white/15 hover:text-white" href={p.links.demo} target="_blank" rel="noopener noreferrer">Live demo</a>}
          </p>
        )}
        {p.stack.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Technologies">
            {p.stack.map((t) => (
              <li key={t} className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-white/50">{t}</li>
            ))}
          </ul>
        )}
      </header>

      <div className="mt-10">
        {s.problem && <Section title="Problem"><p>{s.problem}</p></Section>}
        {s.targetUser && <Section title="Target user"><p>{s.targetUser}</p></Section>}
        {s.whyItMatters && <Section title="Why it matters"><p>{s.whyItMatters}</p></Section>}
        {s.productDecisions && <Section title="Product decisions"><List items={s.productDecisions} /></Section>}
        {s.mvpScope && <Section title="MVP scope"><List items={s.mvpScope} /></Section>}
        {s.today && <Section title="What exists today"><List items={s.today} /></Section>}
        {s.vision && <Section title="Vision (not built yet)"><List items={s.vision} /></Section>}
        {s.architecture && <Section title="Architecture"><p>{s.architecture}</p></Section>}
        {s.dataModel && <Section title="Data model"><p>{s.dataModel}</p></Section>}
        {s.challenges && <Section title="Challenges"><List items={s.challenges} /></Section>}
        {s.tradeoffs && <Section title="Tradeoffs"><List items={s.tradeoffs} /></Section>}
        {s.learned && <Section title="What I learned"><List items={s.learned} /></Section>}
        {s.next && <Section title="What I'd build next"><List items={s.next} /></Section>}
      </div>
    </article>
  );
}
