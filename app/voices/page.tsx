import type { Metadata } from "next";
import { VoiceAvatar } from "@/components/VoiceBadge";
import { VOICE_LIST } from "@/lib/voices";

export const metadata: Metadata = {
  title: "The panel — MHDebate",
  description: "The fourteen voices, what each is for, and where each tends to be wrong.",
};

export default function VoicesPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="font-display text-4xl tracking-tight">The panel</h1>
        <p className="max-w-prose text-lg leading-relaxed text-muted">
          Fourteen voices. Four to six of them are seated for any one question, chosen from what you
          asked rather than from a fixed roster — and the ones left out are recorded too.
        </p>
        <p className="max-w-prose text-sm text-muted">
          Each voice is a plain-language translation of several of the sixty-three clinical
          subject-matter roles in{" "}
          <code className="font-mono text-xs">data/registry.json</code>, which is where the source
          material for this app came from. The <span className="italic">where this tends to be
          wrong</span> line is not decoration: every perspective here has a characteristic failure,
          and knowing it is most of what makes the panel useful.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {VOICE_LIST.map((voice) => (
          <li key={voice.id} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-start gap-3">
              <VoiceAvatar id={voice.id} />
              <div className="min-w-0">
                <h2 className="font-display text-lg leading-tight">{voice.name}</h2>
                <p className="text-sm text-muted">{voice.blurb}</p>
              </div>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Keeps asking</dt>
                <dd className="mt-0.5 leading-relaxed">{voice.lens}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">
                  Where this tends to be wrong
                </dt>
                <dd className="mt-0.5 leading-relaxed text-muted">{voice.blindSpot}</dd>
              </div>
            </dl>

            <div className="mt-auto pt-4">
              {voice.optIn ? (
                <p className="text-xs text-accent">Only seated if you tick the box.</p>
              ) : voice.youthOnly ? (
                <p className="text-xs text-accent">
                  Only seated when the question is about a child or teenager.
                </p>
              ) : null}
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted/70">
                from {voice.sources.join(", ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
