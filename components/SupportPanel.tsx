import { CRISIS_LINES, type SupportLine } from "@/lib/safety";

function LineRow({ line }: { line: SupportLine }) {
  return (
    <li className="flex flex-col gap-0.5 border-t border-line py-3 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-muted">{line.region}</span>
      <span className="flex-1">
        <span className="font-medium">{line.name}</span>{" "}
        <span className="text-accent">— {line.contact}</span>
        {line.note ? <span className="block text-sm text-muted">{line.note}</span> : null}
      </span>
    </li>
  );
}

export function SupportPanel({
  lines = CRISIS_LINES,
  title = "People you can talk to right now",
  intro,
}: {
  lines?: SupportLine[];
  title?: string;
  intro?: string;
}) {
  if (lines.length === 0) return null;

  return (
    <section className="rounded-2xl border border-warn/30 bg-warn-soft p-5 sm:p-6">
      <h2 className="font-display text-xl">{title}</h2>
      {intro ? <p className="mt-2 max-w-prose text-sm">{intro}</p> : null}
      <ul className="mt-4">
        {lines.map((line) => (
          <LineRow key={`${line.name}-${line.contact}`} line={line} />
        ))}
      </ul>
    </section>
  );
}
