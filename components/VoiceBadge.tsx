import { TONE_CLASSES, VOICES } from "@/lib/voices";
import type { VoiceId } from "@/lib/types";

export function VoiceAvatar({ id, size = "md" }: { id: VoiceId; size?: "sm" | "md" }) {
  const voice = VOICES[id];
  const dims = size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-xs";
  return (
    <span
      aria-hidden
      className={`inline-flex ${dims} shrink-0 items-center justify-center rounded-full font-semibold tracking-wide ${TONE_CLASSES[voice.tone]}`}
    >
      {voice.initials}
    </span>
  );
}

/** Inline name pill, used wherever the summary attributes a point to voices. */
export function VoiceNamePill({ id }: { id: VoiceId }) {
  const voice = VOICES[id];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[voice.tone]}`}
      title={voice.blurb}
    >
      {voice.name}
    </span>
  );
}

export function VoiceNameList({ ids }: { ids: VoiceId[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <VoiceNamePill key={id} id={id} />
      ))}
    </span>
  );
}
