import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, projects } from "@/data/projects";
import { StatusBadge } from "@/components/StatusBadge";

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
    <section className="border-t border-line py-8">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-3 max-w-2xl space-y-3 text-muted [&_strong]:text-ink">{children}</div>
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="list-disc space-y-2 pl-5">
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
    <article className="mx-auto max-w-4xl px-6 pb-8 pt-28 md:pt-32">
      <Link href="/#projects" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
        ← Back to work
      </Link>
      <header className="mt-6">
        <StatusBadge status={p.status} confirmed={p.statusConfirmed} />
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{p.title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">{p.tagline}</p>
        {(p.links.github || p.links.demo) && (
          <p className="mt-4 flex gap-4 text-sm">
            {p.links.github && <a className="text-sea underline-offset-4 hover:underline" href={p.links.github}>GitHub</a>}
            {p.links.demo && <a className="text-sea underline-offset-4 hover:underline" href={p.links.demo}>Live demo</a>}
          </p>
        )}
        {p.stack.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="Technologies">
            {p.stack.map((t) => (
              <li key={t} className="rounded-md bg-sunk px-2 py-1 font-mono text-xs text-muted">{t}</li>
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
