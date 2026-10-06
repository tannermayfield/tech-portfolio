import type { Status } from "@/data/projects";

// Status is information, not decoration: each label says how real the project is.
const dot: Record<Status, string> = {
  Live: "bg-emerald-400",
  MVP: "bg-sky-400",
  Prototype: "bg-amber-300",
  "In Development": "bg-orange-400",
  Research: "bg-violet-400",
  Concept: "bg-zinc-400",
};

export function StatusBadge({ status, confirmed = true }: { status: Status; confirmed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 font-mono text-xs text-white">
      <span className={`h-2 w-2 rounded-full ${dot[status]}`} aria-hidden="true" />
      {status}
      {!confirmed && <span className="sr-only"> (to be confirmed)</span>}
    </span>
  );
}
