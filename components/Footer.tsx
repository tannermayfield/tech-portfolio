import { profile } from "@/data/profile";

export function Footer() {
  return (
    <footer className="py-12 text-center opacity-40">
      <p className="text-sm uppercase tracking-widest text-[#aaa]">© {profile.name}</p>
    </footer>
  );
}
