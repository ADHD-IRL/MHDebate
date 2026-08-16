export type VoiceId =
  | "clinician"
  | "body-doctor"
  | "skills-coach"
  | "acceptance-guide"
  | "nervous-system"
  | "relationships"
  | "neurodivergence"
  | "been-there"
  | "careful-skeptic"
  | "overlooked"
  | "practical"
  | "beside-you"
  | "growing-up"
  | "meaning";

export interface Voice {
  id: VoiceId;
  /** What the person reading sees. */
  name: string;
  /** One line, plain language, no jargon. */
  blurb: string;
  /** The single question this voice keeps asking. */
  lens: string;
  /** Two-letter monogram for the avatar. */
  initials: string;
  /** Tailwind hue used for this voice's accent dot. */
  tone: "teal" | "amber" | "violet" | "rose" | "slate" | "green";
  /** Where this voice tends to be wrong. Shown to the reader, not hidden. */
  blindSpot: string;
  /** Instructions the model receives when speaking as this voice. */
  system: string;
  /**
   * Which of the 63 subject-matter agents in data/registry.json this voice
   * stands in for. Kept so the plain-language roster stays traceable back to
   * the clinical source material rather than being invented here.
   */
  sources: string[];
  /** Only seated when the person explicitly opts in. */
  optIn?: boolean;
  /** Only seated when the question is about a child or teenager. */
  youthOnly?: boolean;
}

/** One agreement/disagreement/uncertainty item in the closing summary. */
export interface Takeaway {
  point: string;
  detail: string;
  /** Who said it — voice ids. Used to render the honest support count. */
  voices: VoiceId[];
}

export interface Disagreement {
  topic: string;
  sideA: { voices: VoiceId[]; position: string };
  sideB: { voices: VoiceId[]; position: string };
  /** The observation that would settle it. */
  whatWouldSettleIt: string;
}

export interface Synthesis {
  headline: string;
  plainSummary: string;
  agreements: Takeaway[];
  disagreements: Disagreement[];
  /** Things the reader could notice about themselves that would discriminate. */
  waysToTellApart: string[];
  /** Questions worth bringing to a GP, therapist, or assessor. */
  questionsToAsk: string[];
  /** Small, safe, this-week-sized experiments. Never treatment advice. */
  smallSteps: string[];
  /** What no panel of this kind can know about you. */
  whatThisCannotTell: string[];
}

export interface SeatedVoice {
  id: VoiceId;
  /** Why this voice was invited, in the reader's words. */
  reason: string;
}

export interface UnseatedVoice {
  id: VoiceId;
  reason: string;
}

export interface PanelChoice {
  /** The question restated neutrally, so the reader can correct it. */
  framing: string;
  seated: SeatedVoice[];
  notSeated: UnseatedVoice[];
}

export interface Take {
  voiceId: VoiceId;
  text: string;
}

export interface Challenge {
  voiceId: VoiceId;
  targetId: VoiceId;
  text: string;
}

export type Stage =
  | "idle"
  | "checking"
  | "convening"
  | "first-takes"
  | "cross-talk"
  | "summing-up"
  | "done"
  | "halted"
  | "error";

/** Events pushed over SSE from /api/panel. */
export type PanelEvent =
  | { type: "stage"; stage: Stage }
  | { type: "panel"; panel: PanelChoice }
  | { type: "take-start"; voiceId: VoiceId }
  | { type: "take-delta"; voiceId: VoiceId; text: string }
  | { type: "take-end"; voiceId: VoiceId }
  | { type: "challenge-start"; voiceId: VoiceId; targetId: VoiceId }
  | { type: "challenge-delta"; voiceId: VoiceId; targetId: VoiceId; text: string }
  | { type: "challenge-end"; voiceId: VoiceId; targetId: VoiceId }
  | { type: "synthesis"; synthesis: Synthesis }
  | { type: "halt"; reason: string }
  | { type: "notice"; message: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface PanelRequest {
  question: string;
  /** Who the question is about. Changes which voices are seated. */
  about: "me" | "someone-i-care-about" | "a-child-or-teen";
  /** Opt in to the faith and meaning voice. Off by default. */
  includeMeaningVoice: boolean;
}

/** What we keep in the browser so a reader can revisit a debate. Never sent anywhere. */
export interface SavedDebate {
  id: string;
  createdAt: number;
  request: PanelRequest;
  panel: PanelChoice | null;
  takes: Take[];
  challenges: Challenge[];
  synthesis: Synthesis | null;
  demo: boolean;
}
