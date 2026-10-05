import { profile } from "@/data/profile";
import { LinkIcon } from "./LinkIcon";

export function Footer() {
  return (
    <footer className="border-t border-border/50 px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} {profile.name}
        </p>
        <p>
          {profile.domain} ·{" "}
          <a className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline" href={profile.links.siteRepo}>
            <LinkIcon name="github" />
            Source on GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
