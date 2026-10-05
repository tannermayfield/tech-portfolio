import type { Status } from "@/data/projects";

// Status is information, not decoration: each label says how real the project is.
const dot: Record<Status, string> = {
  Live: "bg-emerald-500",
  MVP: "bg-sea",
  Prototype: "bg-amber-500",
  "In Development": "bg-coral",
  Research: "bg-violet-400",
  Concept: "bg-muted",
};

export function StatusBadge({ status, confirmed = true }: { status: Status; confirmed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-ink">
      <span className={`h-2 w-2 rounded-full ${dot[status]}`} aria-hidden="true" />
      {status}
      {!confirmed && <span className="sr-only"> (to be confirmed)</span>}
    </span>
  );
}
