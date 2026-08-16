import { Prose } from "./Prose";
import { VoiceAvatar } from "./VoiceBadge";
import { VOICES } from "@/lib/voices";
import type { VoiceId } from "@/lib/types";

export function ChallengeCard({
  voiceId,
  targetId,
  text,
  streaming,
}: {
  voiceId: VoiceId;
  targetId: VoiceId;
  text: string;
  streaming: boolean;
}) {
  return (
    <article className="animate-rise rounded-2xl border border-line bg-raised p-5">
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <VoiceAvatar id={voiceId} size="sm" />
        <span className="font-medium">{VOICES[voiceId].name}</span>
        <span aria-hidden className="text-muted">
          →
        </span>
        <span className="sr-only">pushes back on</span>
        <VoiceAvatar id={targetId} size="sm" />
        <span className="font-medium">{VOICES[targetId].name}</span>
      </header>

      <div className="mt-3">
        {text ? (
          <Prose text={text} className="text-[0.975rem]" />
        ) : (
          <p className="text-sm text-muted">Composing…</p>
        )}
        {streaming && text ? (
          <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 animate-pulse2 bg-accent align-text-bottom" />
        ) : null}
      </div>
    </article>
  );
}
