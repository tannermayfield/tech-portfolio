import { Reveal } from "./Reveal";

// The shared section header: small, spaced, grey caps over a hairline rule.
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Reveal className="mb-10 border-b border-white/10 pb-4 sm:mb-12 lg:mb-20">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-[#aaa] sm:text-xl sm:tracking-[0.3em] lg:text-2xl">{children}</h2>
        {aside}
      </div>
    </Reveal>
  );
}
