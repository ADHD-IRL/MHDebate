import type { Stage } from "@/lib/types";

const STEPS: Array<{ stage: Stage; label: string; hint: string }> = [
  { stage: "convening", label: "Choosing who to ask", hint: "Starting from your question, not a roster." },
  { stage: "first-takes", label: "First takes", hint: "Written in parallel — nobody sees the others." },
  { stage: "cross-talk", label: "Cross-talk", hint: "Where they push back on each other." },
  { stage: "summing-up", label: "Summing up", hint: "Agreements, disagreements, and what to do with it." },
];

const ORDER: Stage[] = ["idle", "checking", "convening", "first-takes", "cross-talk", "summing-up", "done"];

export function StageRail({ stage }: { stage: Stage }) {
  if (stage === "idle" || stage === "halted" || stage === "error") return null;
  const current = ORDER.indexOf(stage);

  return (
    <ol className="flex flex-wrap gap-x-2 gap-y-3 text-sm" aria-label="Progress">
      {STEPS.map((step) => {
        const index = ORDER.indexOf(step.stage);
        const done = current > index;
        const active = current === index;
        return (
          <li key={step.stage} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${
                done ? "bg-accent" : active ? "bg-accent animate-pulse2" : "bg-line"
              }`}
            />
            <span
              className={active ? "font-medium text-ink" : done ? "text-muted" : "text-muted/60"}
              title={step.hint}
            >
              {step.label}
            </span>
            {step.stage !== "summing-up" ? (
              <span aria-hidden className="pl-1 text-muted/40">
                ·
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
