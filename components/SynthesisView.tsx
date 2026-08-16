import { Prose } from "./Prose";
import { VoiceNameList } from "./VoiceBadge";
import type { Synthesis } from "@/lib/types";

/**
 * Honest support labels. The clinician-facing original computed an effective
 * sample size from a survey design effect; a reader does not need the
 * arithmetic, they need the conclusion it exists to deliver — that agreement
 * between voices drawn from one model is weak evidence. So: a plain count, and
 * a standing caveat, rather than a number that looks more precise than it is.
 */
export function supportLabel(count: number, total: number): string {
  if (total <= 0) return "";
  if (count === 1) return "One voice";
  if (count === total) return "Every voice";
  if (count >= Math.ceil(total * 0.6)) return `Most of the panel (${count} of ${total})`;
  return `${count} of ${total} voices`;
}

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-display text-xl">{title}</h3>
        {blurb ? <p className="mt-1 max-w-prose text-sm text-muted">{blurb}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span className="text-[0.975rem] leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function SynthesisView({
  synthesis,
  panelSize,
}: {
  synthesis: Synthesis;
  panelSize: number;
}) {
  return (
    <div className="space-y-10">
      <header className="animate-rise rounded-2xl border border-accent/30 bg-accent-soft p-6">
        <p className="text-xs uppercase tracking-widest text-muted">What it adds up to</p>
        <h2 className="mt-2 font-display text-2xl leading-snug sm:text-3xl">{synthesis.headline}</h2>
        <Prose text={synthesis.plainSummary} className="mt-4 max-w-prose" />
      </header>

      {synthesis.agreements.length > 0 ? (
        <Section
          title="Where they agreed"
          blurb="Agreement is a starting point, not a verdict — these voices share one underlying model and can be confidently wrong together."
        >
          <ul className="space-y-3">
            {synthesis.agreements.map((item, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-medium">{item.point}</h4>
                  <span className="text-xs uppercase tracking-wide text-muted">
                    {supportLabel(item.voices.length, panelSize)}
                  </span>
                </div>
                <p className="mt-1.5 text-[0.975rem] leading-relaxed text-muted">{item.detail}</p>
                <div className="mt-3">
                  <VoiceNameList ids={item.voices} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {synthesis.disagreements.length > 0 ? (
        <Section
          title="Where they didn't"
          blurb="Kept deliberately. A disagreement that gets smoothed over costs you the information in it."
        >
          <ul className="space-y-4">
            {synthesis.disagreements.map((item, i) => (
              <li key={i} className="overflow-hidden rounded-xl border border-line bg-surface">
                <h4 className="border-b border-line px-4 py-3 font-medium">{item.topic}</h4>
                <div className="grid gap-px bg-line sm:grid-cols-2">
                  {[item.sideA, item.sideB].map((side, s) => (
                    <div key={s} className="bg-surface p-4">
                      <VoiceNameList ids={side.voices} />
                      <p className="mt-2 text-[0.975rem] leading-relaxed">{side.position}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-line bg-raised px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted">What would settle it</p>
                  <p className="mt-1 text-[0.975rem] leading-relaxed">{item.whatWouldSettleIt}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {synthesis.waysToTellApart.length > 0 ? (
        <Section
          title="Things you could notice"
          blurb="Observations that would separate the explanations on the table. None of them need a clinic."
        >
          <Checklist items={synthesis.waysToTellApart} />
        </Section>
      ) : null}

      {synthesis.questionsToAsk.length > 0 ? (
        <Section
          title="Worth asking a professional"
          blurb="Phrased so you could say them out loud in an appointment."
        >
          <Checklist items={synthesis.questionsToAsk} />
        </Section>
      ) : null}

      {synthesis.smallSteps.length > 0 ? (
        <Section title="Small enough to try this week">
          <Checklist items={synthesis.smallSteps} />
        </Section>
      ) : null}

      {synthesis.whatThisCannotTell.length > 0 ? (
        <Section title="What this cannot tell you">
          <ul className="space-y-2 rounded-xl border border-line bg-raised p-4">
            {synthesis.whatThisCannotTell.map((item, i) => (
              <li key={i} className="flex gap-3 text-[0.975rem] leading-relaxed text-muted">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/50" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
