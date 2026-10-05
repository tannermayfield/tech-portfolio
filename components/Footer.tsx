import { profile } from "@/data/profile";
import { Wave } from "./Wave";

export function Footer() {
  const { links } = profile;
  return (
    <footer className="mt-24 text-foam">
      <Wave />
      <div className="bg-foam">
        <div className="container-page flex flex-col gap-4 py-10 text-sm text-ink sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {profile.name} · {profile.domain}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li><a className="underline-offset-4 hover:underline" href={links.github}>GitHub</a></li>
            <li><a className="underline-offset-4 hover:underline" href={links.linkedin}>LinkedIn</a></li>
            <li><a className="underline-offset-4 hover:underline" href={`mailto:${links.email}`}>Email</a></li>
            <li><a className="underline-offset-4 hover:underline" href={links.resume}>Resume</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
