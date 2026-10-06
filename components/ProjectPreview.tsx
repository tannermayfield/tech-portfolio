import type { Project } from "@/data/projects";

// Stand-in for a project screenshot. We never fake screenshots: until `project.image` is set,
// this shows the project name over a faint grid with an honest "preview coming soon" note.
export function ProjectPreview({ project }: { project: Project }) {
  if (project.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={project.image} alt={`${project.title} screenshot`} className="block h-auto w-full" />;
  }
  return (
    <div
      role="img"
      aria-label={`${project.title}: screenshot coming soon`}
      className="relative flex aspect-[16/10] w-full flex-col items-center justify-center overflow-hidden bg-neutral-900/50 p-6 text-center"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(60% 60% at 50% 40%, rgba(224,231,255,0.10), transparent 70%), linear-gradient(rgba(224,231,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(224,231,255,0.05) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        }}
      />
      <span className="font-poppins relative text-3xl font-bold uppercase tracking-tight text-white/90 sm:text-4xl xl:text-5xl">{project.title}</span>
      <span className="relative mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">Preview coming soon</span>
    </div>
  );
}
