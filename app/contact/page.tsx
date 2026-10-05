import type { Metadata } from "next";
import { profile } from "@/data/profile";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Tanner Mayfield about software engineering, AI, and full-stack internships.",
};

export default function Contact() {
  const { links } = profile;
  const items = [
    { label: "Email", value: links.email, href: `mailto:${links.email}` },
    { label: "LinkedIn", value: "linkedin.com/in/tanner-mayfield", href: links.linkedin },
    { label: "GitHub", value: "github.com/tannermayfield", href: links.github },
    { label: "Resume", value: "Download PDF", href: links.resume },
  ];
  return (
    <div className="container-page pb-8 pt-16 md:pt-20">
      <p className="eyebrow">Contact</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">Let's talk.</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        I'm looking for software engineering, AI, and full-stack internships. Email is the fastest way to reach me.
      </p>
      <ul className="mt-10 grid max-w-2xl gap-4">
        {items.map((i) => (
          <li key={i.label}>
            <a
              href={i.href}
              className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-6 py-4 transition-colors hover:border-sea"
            >
              <span className="eyebrow">{i.label}</span>
              <span className="text-right">{i.value} →</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
