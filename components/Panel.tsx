"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AskForm, type Example, type ProviderInfo } from "./AskForm";
import { ChallengeCard } from "./ChallengeCard";
import { StageRail } from "./StageRail";
import { SupportPanel } from "./SupportPanel";
import { SynthesisView } from "./SynthesisView";
import { TakeCard } from "./TakeCard";
import { VoiceNamePill } from "./VoiceBadge";
import { usePanel, type StartOptions } from "@/lib/usePanel";
import { CRISIS_LINES, supportFor } from "@/lib/safety";
import { VOICES } from "@/lib/voices";
import type { PanelRequest } from "@/lib/types";

/** `intro` is rendered only while the form is showing, so the hero gets out of
 *  the way once the panel is actually talking. */
export function Panel({ intro }: { intro?: React.ReactNode }) {
  const { state, start, reset } = usePanel();
  const [config, setConfig] = useState<{
    demo: boolean;
    examples: Example[];
    provider: ProviderInfo | null;
  } | null>(null);
  const [pending, setPending] = useState<PanelRequest | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/panel")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setConfig({
            demo: Boolean(data.demo),
            examples: data.examples ?? [],
            provider: data.provider ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setConfig({ demo: false, examples: [], provider: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Scroll to the transcript once, when the panel is actually convened, rather
  // than yanking the page on every token.
  const scrolled = useRef(false);
  useEffect(() => {
    if (state.panel && !scrolled.current) {
      scrolled.current = true;
      transcriptRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (state.stage === "idle") scrolled.current = false;
  }, [state.panel, state.stage]);

  const running = ["checking", "convening", "first-takes", "cross-talk", "summing-up"].includes(
    state.stage,
  );
  const finished = state.stage === "done";

  const run = (options: StartOptions) => {
    setPending(options);
    void start(options);
  };

  // -------------------------------------------------------- crisis stop

  if (state.stage === "halted") {
    return (
      <div className="space-y-8">
        <div className="rounded-2xl border border-warn/40 bg-warn-soft p-6">
          <h2 className="font-display text-2xl">Let's stop here for a moment.</h2>
          <p className="mt-3 max-w-prose">
            What you wrote suggests you or someone else might be in danger right now. A panel of AI
            perspectives is the wrong tool for that, and pretending otherwise would waste time you
            may not have.
          </p>
          <p className="mt-3 max-w-prose">
            The people below answer straight away, they have heard it before, and you do not have to
            be in an emergency to call them.
          </p>
        </div>

        <SupportPanel />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setPending(null);
              reset();
            }}
            className="rounded-full border border-line px-5 py-2.5 text-sm transition-colors hover:border-accent"
          >
            Go back
          </button>
          <Link
            href="/support"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[rgb(var(--surface))]"
          >
            More ways to get help
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------- resources before continuing

  if (state.needsAcknowledgement && pending) {
    const extra = supportFor(state.needsAcknowledgement);
    return (
      <div className="space-y-8">
        <div className="rounded-2xl border border-warn/40 bg-warn-soft p-6">
          <h2 className="font-display text-2xl">Before the panel starts</h2>
          <p className="mt-3 max-w-prose">
            Your question touches on something serious. That is a completely reasonable thing to
            want to understand, and the panel will run if you want it to — but it seemed wrong to
            hand you a discussion without first showing you where the actual help is.
          </p>
        </div>

        <SupportPanel />
        {extra.length > 0 ? <SupportPanel lines={extra} title="Specific to what you asked" /> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => run({ ...pending, acknowledgedSupport: true })}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[rgb(var(--surface))]"
          >
            I've read these — continue to the panel
          </button>
          <button
            type="button"
            onClick={() => {
              setPending(null);
              reset();
            }}
            className="rounded-full border border-line px-5 py-2.5 text-sm transition-colors hover:border-accent"
          >
            Change what I asked
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- form

  if (state.stage === "idle") {
    return (
      <div className="space-y-10">
        {intro}
        {config ? (
          <AskForm
            demo={config.demo}
            provider={config.provider}
            examples={config.examples}
            busy={false}
            onSubmit={(request) => run(request)}
            onDemo={(slug) =>
              run({
                demoSlug: slug,
                question: config.examples.find((e) => e.slug === slug)?.question ?? "",
                about: "me",
                includeMeaningVoice: false,
              })
            }
          />
        ) : (
          <p className="text-muted">Loading…</p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------- transcript

  const seatedReason = new Map(state.panel?.seated.map((s) => [s.id, s.reason]) ?? []);
  const panelSize = state.panel?.seated.length ?? Object.keys(state.takes).length;

  return (
    <div ref={transcriptRef} className="space-y-10 scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <StageRail stage={state.stage} />
        <button
          type="button"
          onClick={() => {
            setPending(null);
            reset();
          }}
          className="text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          {running ? "Stop and start over" : "Ask something else"}
        </button>
      </div>

      {state.notices.map((notice, i) => (
        <p key={i} className="rounded-xl border border-line bg-raised px-4 py-3 text-sm text-muted">
          {notice}
        </p>
      ))}

      {state.error ? (
        <div className="rounded-2xl border border-warn/40 bg-warn-soft p-5">
          <h2 className="font-display text-lg">That didn't finish</h2>
          <p className="mt-2 max-w-prose text-sm">{state.error}</p>
        </div>
      ) : null}

      {state.panel ? (
        <section className="animate-rise space-y-4">
          <div>
            <h2 className="font-display text-2xl">Who's in the room</h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              Chosen from your question, not from a fixed roster.
            </p>
          </div>

          {state.panel.framing ? (
            <blockquote className="rounded-xl border-l-2 border-accent bg-surface px-4 py-3 text-[0.975rem]">
              <span className="block text-xs uppercase tracking-wide text-muted">
                How the panel read your question
              </span>
              {state.panel.framing}
            </blockquote>
          ) : null}

          <ul className="grid gap-3 sm:grid-cols-2">
            {state.panel.seated.map((seat) => (
              <li key={seat.id} className="rounded-xl border border-line bg-surface p-4">
                <VoiceNamePill id={seat.id} />
                <p className="mt-2 text-sm text-muted">{seat.reason}</p>
              </li>
            ))}
          </ul>

          {state.panel.notSeated.length > 0 ? (
            <details className="rounded-xl border border-line bg-raised p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Who was left out, and why
              </summary>
              <p className="mt-2 max-w-prose text-sm text-muted">
                Recorded on purpose. Writing down the exclusions is what stops the panel quietly
                becoming the same voices for every question.
              </p>
              <ul className="mt-3 space-y-2">
                {state.panel.notSeated.map((seat) => (
                  <li key={seat.id} className="text-sm">
                    <span className="font-medium">{VOICES[seat.id].name}</span>
                    <span className="text-muted"> — {seat.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : running && state.stage === "convening" ? (
        <p className="text-muted">Working out who should be in the room…</p>
      ) : null}

      {Object.keys(state.takes).length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl">First takes</h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              Written at the same time, in separate contexts. None of these voices can see the
              others yet — that's what keeps the first round from collapsing into agreement.
            </p>
          </div>
          <div className="space-y-4">
            {Object.entries(state.takes).map(([voiceId, take]) => (
              <TakeCard
                key={voiceId}
                voiceId={voiceId as keyof typeof VOICES}
                text={take.text}
                streaming={take.streaming}
                reason={seatedReason.get(voiceId as keyof typeof VOICES)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {state.challenges.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-2xl">Cross-talk</h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              Now they've read each other. Each push-back has to name something the reader could
              check — a disagreement with no way to settle it is just noise.
            </p>
          </div>
          <div className="space-y-4">
            {state.challenges.map((challenge, i) => (
              <ChallengeCard key={`${challenge.voiceId}-${challenge.targetId}-${i}`} {...challenge} />
            ))}
          </div>
        </section>
      ) : null}

      {state.stage === "summing-up" && !state.synthesis ? (
        <p className="text-muted">Pulling the threads together…</p>
      ) : null}

      {state.synthesis ? <SynthesisView synthesis={state.synthesis} panelSize={panelSize} /> : null}

      {finished ? (
        <div className="space-y-6 border-t border-line pt-8">
          <div className="rounded-2xl border border-line bg-raised p-5">
            <h2 className="font-display text-lg">One last thing</h2>
            <p className="mt-2 max-w-prose text-sm text-muted">
              Nothing here is a diagnosis, and no part of this conversation was stored on our
              server. If any of it landed, the useful next move is usually to take two lines of it
              to someone who can ask you questions back.
            </p>
          </div>

          <details className="rounded-xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Support lines, if you want them
            </summary>
            <div className="mt-4">
              <SupportPanel lines={CRISIS_LINES} title="If you need a person" />
            </div>
          </details>

          <button
            type="button"
            onClick={() => {
              setPending(null);
              reset();
            }}
            className="rounded-full bg-accent px-6 py-3 font-medium text-[rgb(var(--surface))]"
          >
            Ask something else
          </button>
        </div>
      ) : null}
    </div>
  );
}
