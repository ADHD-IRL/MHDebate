"use client";

import { useState } from "react";
import { Prose } from "./Prose";
import { VoiceAvatar } from "./VoiceBadge";
import { VOICES } from "@/lib/voices";
import type { VoiceId } from "@/lib/types";

export function TakeCard({
  voiceId,
  text,
  streaming,
  reason,
}: {
  voiceId: VoiceId;
  text: string;
  streaming: boolean;
  reason?: string;
}) {
  const voice = VOICES[voiceId];
  const [showBlindSpot, setShowBlindSpot] = useState(false);

  return (
    <article className="animate-rise rounded-2xl border border-line bg-surface p-5">
      <header className="flex items-start gap-3">
        <VoiceAvatar id={voiceId} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg leading-tight">{voice.name}</h3>
          <p className="text-sm text-muted">{voice.blurb}</p>
          {reason ? <p className="mt-1 text-sm text-accent">Invited because: {reason}</p> : null}
        </div>
      </header>

      <div className="mt-4">
        {text ? (
          <Prose text={text} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-accent" />
            Thinking…
          </p>
        )}
        {streaming && text ? (
          <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 animate-pulse2 bg-accent align-text-bottom" />
        ) : null}
      </div>

      {!streaming && text ? (
        <footer className="mt-4 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setShowBlindSpot((v) => !v)}
            className="text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-ink"
            aria-expanded={showBlindSpot}
          >
            Where this voice tends to be wrong
          </button>
          {showBlindSpot ? (
            <p className="mt-2 max-w-prose text-sm text-muted">{voice.blindSpot}</p>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
