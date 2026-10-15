import { profile } from "@/data/profile";
import { Icon, type IconName } from "./Icon";
import { Reveal } from "./Reveal";
import { SectionTitle } from "./SectionTitle";

const contacts: { label: string; href: string; icon: IconName; external?: boolean }[] = [
  { label: "linkedin.com/in/tanner-mayfield", href: profile.links.linkedin, icon: "linkedin", external: true },
  { label: "github.com/tannermayfield", href: profile.links.github, icon: "github", external: true },
  { label: profile.links.email, href: `mailto:${profile.links.email}`, icon: "mail" },
];

export function Connect() {
  return (
    <footer id="connect" aria-label="Let's Connect" className="mx-auto min-w-0 max-w-6xl px-0 pb-4 pt-6 sm:pb-4 sm:pt-8 lg:px-6 lg:pb-6 lg:pt-10">
      <SectionTitle>Let&apos;s Connect</SectionTitle>
      <Reveal className="-mt-8 text-center sm:-mt-10 lg:-mt-16">
        <div className="flex flex-col items-center justify-center gap-3 md:flex-row md:flex-nowrap md:gap-4 lg:gap-6">
          {contacts.map((contact) => (
            <a
              key={contact.label}
              href={contact.href}
              target={contact.external ? "_blank" : undefined}
              rel={contact.external ? "noopener noreferrer" : undefined}
              className="btn-shine group inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-moonstone-border bg-transparent px-4 py-3 text-sm font-bold text-moonstone transition-all duration-300 hover:bg-white md:w-auto md:px-3 md:text-xs lg:gap-3 lg:px-6 lg:text-sm"
            >
              <Icon name={contact.icon} size={20} />
              <span>{contact.label}</span>
            </a>
          ))}
        </div>
      </Reveal>
    </footer>
  );
}
