import { Icon, type IconName } from "./Icon";
import { profile } from "@/data/profile";

const items: { icon: IconName; label: string; href: string; external: boolean }[] = [
  { icon: "linkedin", label: "LinkedIn", href: profile.links.linkedin, external: true },
  { icon: "github", label: "GitHub", href: profile.links.github, external: true },
  { icon: "mail", label: "Email", href: `mailto:${profile.links.email}`, external: false },
];

// Fixed right-hand rail (desktop). This is where contact info lives; there is no contact section.
export function SocialRail() {
  return (
    <aside className="fixed right-0 top-1/2 z-50 hidden w-[80px] -translate-y-1/2 flex-col items-end space-y-6 pr-6 text-[#aaa] lg:flex xl:w-[120px] xl:pr-8">
      {items.map((i) => (
        <a
          key={i.label}
          href={i.href}
          aria-label={i.label}
          title={i.label}
          {...(i.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="flex min-h-[44px] items-center transition-colors duration-300 hover:text-white"
        >
          <Icon name={i.icon} />
        </a>
      ))}
    </aside>
  );
}
