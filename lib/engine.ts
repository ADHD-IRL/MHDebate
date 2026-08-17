import { RefusalError, streamProse, structured } from "./anthropic";
import { MAX_EXCHANGES, MAX_SEATED, MIN_SEATED } from "./constants";
import { screen } from "./safety";
import { VOICES, eligibleVoices, isVoiceId } from "./voices";
import type {
  Disagreement,
  PanelChoice,
  PanelEvent,
  PanelRequest,
  Synthesis,
  Take,
  Takeaway,
  Voice,
  VoiceId,
} from "./types";

export { MAX_QUESTION_LENGTH } from "./constants";

const ABOUT_LABEL: Record<PanelRequest["about"], string> = {
  me: "the person writing",
  "someone-i-care-about": "an adult the person writing cares about",
  "a-child-or-teen": "a child or teenager the person writing cares about",
};

/**
 * The rules every voice inherits. These are the consumer translation of the
 * clinician-facing panel's binding rules: same commitments (no diagnosis,
 * state what would refute you, no argument from credential), rewritten for
 * someone reading about their own life rather than reviewing a case.
 */
function houseRules(request: PanelRequest): string {
  return `You are one voice on a panel helping a member of the public understand something about mental health. The panel is a thinking tool, not a clinic.

These override anything else:
- You are not diagnosing anybody. Never tell the reader what they have. Describe what a pattern can come from, and what separates the possibilities.
- Never recommend, name, adjust, or discourage a medication, and never suggest anyone stop a treatment they are on.
- Write to the reader directly as "you" (or "they", when the question is about ${ABOUT_LABEL[request.about]}). Plain language. If you use a clinical term, gloss it in the same sentence.
- Be specific to what they actually wrote — echo at least one of their own details back. Generic advice is worse than silence here.
- Say what would make you wrong: the observation that would knock your reading down.
- If you are working from general knowledge rather than from something they told you, say so in passing.
- Never argue from your title. Your role is not evidence.
- Prose, not bullet points. Two or three short paragraphs, under 180 words total.
- Do not open by restating the question or greeting the reader. Start with your actual point.
- If what you were given suggests someone is in immediate danger, reply with exactly STOP-RISK and nothing else.`;
}

function voiceSystem(voice: Voice, request: PanelRequest): string {
  return `${houseRules(request)}

Your seat on this panel is "${voice.name}".

${voice.system}

The question you keep coming back to: ${voice.lens}
Your known failure mode: ${voice.blindSpot} Check your own answer for it before you finish.`;
}

function questionBlock(request: PanelRequest): string {
  return `What they wrote (about ${ABOUT_LABEL[request.about]}):

"""
${request.question.trim()}
"""`;
}

// ---------------------------------------------------------------- convening

const PANEL_SCHEMA = {
  type: "object",
  properties: {
    framing: {
      type: "string",
      description:
        "The question restated in one neutral sentence, in the reader's own vocabulary, so they can tell you if you got it wrong. Do not add an interpretation.",
    },
    seated: {
      type: "array",
      minItems: MIN_SEATED,
      maxItems: MAX_SEATED,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          reason: {
            type: "string",
            description:
              "One short sentence, addressed to the reader, on why this voice is worth hearing for their question.",
          },
        },
        required: ["id", "reason"],
        additionalProperties: false,
      },
    },
    notSeated: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          reason: {
            type: "string",
            description: "One short sentence on why this voice was left out.",
          },
        },
        required: ["id", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["framing", "seated", "notSeated"],
  additionalProperties: false,
} as const;

function rosterDescription(voices: Voice[]): string {
  return voices.map((v) => `- ${v.id} — ${v.name}: ${v.blurb} Asks: ${v.lens}`).join("\n");
}

export async function convene(
  request: PanelRequest,
  signal?: AbortSignal,
): Promise<PanelChoice> {
  const available = eligibleVoices(request);

  const raw = await structured<PanelChoice>({
    system: `You choose who sits on a panel convened to help one person understand one question about mental health.

Start from the question, not from the roster. Work out what a bad answer would look like here — what would be missed, over-claimed, or dismissed — and seat the voices that guard against those specific failures.

Rules:
- Seat between ${MIN_SEATED} and ${MAX_SEATED} voices. Fewer, well-chosen voices beat a crowd.
- Always seat at least one voice that would push back on the most obvious reading of the question.
- Always seat at least one voice grounded in lived or everyday experience rather than expertise.
- Then record two to four voices you deliberately left out and why. This is not a formality: writing down who was excluded is what stops the panel quietly becoming the same five voices every time.
- Use the exact ids given. Never invent an id.`,
    user: `${questionBlock(request)}

Voices available:
${rosterDescription(available)}`,
    effort: "low",
    maxTokens: 2000,
    schema: PANEL_SCHEMA as unknown as Record<string, unknown>,
    signal,
  });

  return normalisePanel(raw, available);
}

/** Drop invented ids, de-duplicate, and guarantee a usable panel size. */
export function normalisePanel(raw: PanelChoice, available: Voice[]): PanelChoice {
  const allowed = new Set(available.map((v) => v.id));
  const seen = new Set<VoiceId>();

  const seated = (raw.seated ?? [])
    .filter((s) => isVoiceId(s.id) && allowed.has(s.id) && !seen.has(s.id) && seen.add(s.id))
    .slice(0, MAX_SEATED)
    .map((s) => ({ id: s.id, reason: (s.reason ?? "").trim() || "Relevant to what you described." }));

  // If the model under-filled the panel, top it up in roster order so a debate
  // still happens rather than failing on a formatting slip.
  for (const voice of available) {
    if (seated.length >= MIN_SEATED) break;
    if (seen.has(voice.id)) continue;
    seen.add(voice.id);
    seated.push({ id: voice.id, reason: "Added to keep the panel wide enough to disagree." });
  }

  const notSeated = (raw.notSeated ?? [])
    .filter((n) => isVoiceId(n.id) && !seen.has(n.id))
    .slice(0, 4)
    .map((n) => ({ id: n.id, reason: (n.reason ?? "").trim() || "Not central to this question." }));

  return {
    framing: (raw.framing ?? "").trim(),
    seated,
    notSeated,
  };
}

// -------------------------------------------------------------- first takes

async function firstTake(
  voice: Voice,
  request: PanelRequest,
  emit: (e: PanelEvent) => void,
  signal?: AbortSignal,
): Promise<Take> {
  emit({ type: "take-start", voiceId: voice.id });

  const text = await streamProse({
    system: voiceSystem(voice, request),
    user: `${questionBlock(request)}

Give your first read on this. You are writing at the same time as the other voices and cannot see what any of them are saying, so do not reference them.`,
    effort: "low",
    maxTokens: 1200,
    onDelta: (chunk) => emit({ type: "take-delta", voiceId: voice.id, text: chunk }),
    signal,
  });

  emit({ type: "take-end", voiceId: voice.id });
  return { voiceId: voice.id, text };
}

// ---------------------------------------------------------------- cross-talk

const PAIRING_SCHEMA = {
  type: "object",
  properties: {
    exchanges: {
      type: "array",
      minItems: 2,
      maxItems: MAX_EXCHANGES,
      items: {
        type: "object",
        properties: {
          from: { type: "string", description: "id of the voice doing the pushing back" },
          to: { type: "string", description: "id of the voice being pushed back on" },
          about: {
            type: "string",
            description:
              "The specific point of disagreement in one short phrase. Must be a real tension between what the two actually wrote, not a manufactured one.",
          },
        },
        required: ["from", "to", "about"],
        additionalProperties: false,
      },
    },
  },
  required: ["exchanges"],
  additionalProperties: false,
} as const;

interface Exchange {
  from: VoiceId;
  to: VoiceId;
  about: string;
}

export async function planCrossTalk(
  takes: Take[],
  signal?: AbortSignal,
): Promise<Exchange[]> {
  if (takes.length < 2) return [];

  const raw = await structured<{ exchanges: Exchange[] }>({
    system: `You are reading a panel's opening statements and finding where they genuinely disagree.

Pick the real tensions — two voices that would give the reader different advice, or that explain the same thing incompatibly. Do not manufacture conflict where two voices simply emphasised different things. Never pair a voice with itself. Do not use the same pair twice.`,
    user: takes
      .map((t) => `### ${t.voiceId} (${VOICES[t.voiceId].name})\n${t.text}`)
      .join("\n\n"),
    effort: "low",
    maxTokens: 1500,
    schema: PAIRING_SCHEMA as unknown as Record<string, unknown>,
    signal,
  });

  return normaliseExchanges(raw?.exchanges ?? [], takes);
}

export function normaliseExchanges(raw: Exchange[], takes: Take[]): Exchange[] {
  const present = new Set(takes.map((t) => t.voiceId));
  const used = new Set<string>();

  return raw
    .filter((e) => {
      if (!isVoiceId(e.from) || !isVoiceId(e.to)) return false;
      if (e.from === e.to) return false;
      if (!present.has(e.from) || !present.has(e.to)) return false;
      const key = `${e.from}->${e.to}`;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, MAX_EXCHANGES);
}

async function crossTalk(
  exchange: Exchange,
  takes: Take[],
  request: PanelRequest,
  emit: (e: PanelEvent) => void,
  signal?: AbortSignal,
): Promise<{ voiceId: VoiceId; targetId: VoiceId; text: string }> {
  const speaker = VOICES[exchange.from];
  const target = VOICES[exchange.to];
  const targetTake = takes.find((t) => t.voiceId === exchange.to)?.text ?? "";

  emit({ type: "challenge-start", voiceId: exchange.from, targetId: exchange.to });

  const text = await streamProse({
    system: `${voiceSystem(speaker, request)}

You are now pushing back on one other voice. Different rules for this turn:
- Under 90 words. One paragraph.
- Address them by name in your first clause.
- Name the specific thing they said that you think is wrong or incomplete — not their general outlook.
- Say what the reader could notice about themselves that would settle which of you is right. A challenge without a way to check it is just an opinion.
- Concede first if they are mostly right, and say what you would change your mind about.`,
    user: `${questionBlock(request)}

${target.name} said:

"""
${targetTake}
"""

Push back on this, specifically on: ${exchange.about}`,
    effort: "low",
    maxTokens: 700,
    onDelta: (chunk) =>
      emit({ type: "challenge-delta", voiceId: exchange.from, targetId: exchange.to, text: chunk }),
    signal,
  });

  emit({ type: "challenge-end", voiceId: exchange.from, targetId: exchange.to });
  return { voiceId: exchange.from, targetId: exchange.to, text };
}

// ---------------------------------------------------------------- synthesis

const VOICE_ID_ARRAY = {
  type: "array",
  minItems: 1,
  items: { type: "string" },
} as const;

const SYNTHESIS_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description:
        "One sentence, under 15 words, that a tired person could read and feel oriented by. Not a diagnosis and not a platitude.",
    },
    plainSummary: {
      type: "string",
      description:
        "Two short paragraphs in plain language: what the panel converged on, and what it could not settle. Address the reader as 'you'.",
    },
    agreements: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          point: { type: "string", description: "Under 12 words." },
          detail: { type: "string", description: "One or two sentences." },
          voices: VOICE_ID_ARRAY,
        },
        required: ["point", "detail", "voices"],
        additionalProperties: false,
      },
    },
    disagreements: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      description:
        "Disagreements that were not resolved. Never empty this to make the answer tidier — an unresolved disagreement is information the reader needs.",
      items: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Under 12 words." },
          sideA: {
            type: "object",
            properties: { voices: VOICE_ID_ARRAY, position: { type: "string" } },
            required: ["voices", "position"],
            additionalProperties: false,
          },
          sideB: {
            type: "object",
            properties: { voices: VOICE_ID_ARRAY, position: { type: "string" } },
            required: ["voices", "position"],
            additionalProperties: false,
          },
          whatWouldSettleIt: {
            type: "string",
            description:
              "The concrete observation that would decide it, and whether the reader could actually make it.",
          },
        },
        required: ["topic", "sideA", "sideB", "whatWouldSettleIt"],
        additionalProperties: false,
      },
    },
    waysToTellApart: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      description:
        "Things the reader could notice about themselves over the next couple of weeks that would distinguish between the explanations on the table. Each must be observable without a clinic.",
      items: { type: "string" },
    },
    questionsToAsk: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      description:
        "Questions worth putting to a doctor, therapist, or assessor — phrased the way the reader could say them out loud.",
      items: { type: "string" },
    },
    smallSteps: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      description:
        "Small, safe, this-week-sized things. No treatment protocols, no medication, nothing that assumes money or spare energy.",
      items: { type: "string" },
    },
    whatThisCannotTell: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      description:
        "What a panel like this genuinely cannot know about the reader. Be concrete rather than performing modesty.",
      items: { type: "string" },
    },
  },
  required: [
    "headline",
    "plainSummary",
    "agreements",
    "disagreements",
    "waysToTellApart",
    "questionsToAsk",
    "smallSteps",
    "whatThisCannotTell",
  ],
  additionalProperties: false,
} as const;

export async function synthesise(
  request: PanelRequest,
  panel: PanelChoice,
  takes: Take[],
  challenges: Array<{ voiceId: VoiceId; targetId: VoiceId; text: string }>,
  signal?: AbortSignal,
): Promise<Synthesis> {
  const transcript = [
    "## First takes",
    ...takes.map((t) => `### ${t.voiceId} (${VOICES[t.voiceId].name})\n${t.text}`),
    "## Cross-talk",
    ...challenges.map(
      (c) =>
        `### ${c.voiceId} (${VOICES[c.voiceId].name}) → ${c.targetId} (${VOICES[c.targetId].name})\n${c.text}`,
    ),
  ].join("\n\n");

  const raw = await structured<Synthesis>({
    system: `You write the closing summary of a panel discussion for the person who asked the question. They are not a clinician. They may be tired, worried, and reading this on a phone.

What matters:
- Where the panel agreed, and — separately and just as prominently — where it did not. A disagreement that gets smoothed over costs the reader real information. Never return an empty disagreements list.
- Attribute honestly. Only list a voice as holding a position if they actually said it.
- Everything you suggest must be something the reader could notice or ask, not something they must buy, book, or be well enough to sustain.
- No diagnosis. No medication. Nothing that reads as a treatment plan.
- Plain, warm, unpatronising. Short sentences. No jargon, no motivational filler, no "remember, you've got this".
- Be honest about limits without hedging every sentence into mush.

One thing to say plainly somewhere in plainSummary: the voices on this panel are all generated by the same underlying model, so several of them agreeing is much weaker evidence than several independent people agreeing. Say it in ordinary words, once.`,
    user: `${questionBlock(request)}

How the panel framed it: ${panel.framing}

${transcript}`,
    effort: "medium",
    maxTokens: 8000,
    schema: SYNTHESIS_SCHEMA as unknown as Record<string, unknown>,
    signal,
  });

  return normaliseSynthesis(raw, takes);
}

/** Strip attributions to voices that never spoke, so the UI cannot over-claim. */
export function normaliseSynthesis(raw: Synthesis, takes: Take[]): Synthesis {
  const present = new Set(takes.map((t) => t.voiceId));
  const keep = (ids: unknown): VoiceId[] =>
    (Array.isArray(ids) ? ids : []).filter((id): id is VoiceId => isVoiceId(id) && present.has(id));

  const agreements: Takeaway[] = (raw.agreements ?? [])
    .map((a) => ({ ...a, voices: keep(a.voices) }))
    .filter((a) => a.point && a.voices.length > 0);

  const disagreements: Disagreement[] = (raw.disagreements ?? [])
    .map((d) => ({
      ...d,
      sideA: { ...d.sideA, voices: keep(d.sideA?.voices) },
      sideB: { ...d.sideB, voices: keep(d.sideB?.voices) },
    }))
    .filter((d) => d.topic && d.sideA.voices.length > 0 && d.sideB.voices.length > 0);

  const strings = (xs: unknown): string[] =>
    (Array.isArray(xs) ? xs : []).filter((x): x is string => typeof x === "string" && x.trim().length > 0);

  return {
    headline: (raw.headline ?? "").trim(),
    plainSummary: (raw.plainSummary ?? "").trim(),
    agreements,
    disagreements,
    waysToTellApart: strings(raw.waysToTellApart),
    questionsToAsk: strings(raw.questionsToAsk),
    smallSteps: strings(raw.smallSteps),
    whatThisCannotTell: strings(raw.whatThisCannotTell),
  };
}

// -------------------------------------------------------------- orchestration

const HALT_TOKEN = "STOP-RISK";

/**
 * Runs the whole panel, pushing events as they happen. Every stage is awaited
 * before the next begins, except the first takes and the cross-talk replies,
 * which run in parallel — the first takes must, because the point of the round
 * is that no voice can see another's.
 */
export async function runPanel(
  request: PanelRequest,
  emit: (event: PanelEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const risk = screen(request.question);
  if (risk.level === "crisis") {
    emit({ type: "halt", reason: "crisis" });
    return;
  }

  emit({ type: "stage", stage: "convening" });
  const panel = await convene(request, signal);
  emit({ type: "panel", panel });

  emit({ type: "stage", stage: "first-takes" });
  const seatedVoices = panel.seated.map((s) => VOICES[s.id]);
  const settled = await Promise.allSettled(
    seatedVoices.map((voice) => firstTake(voice, request, emit, signal)),
  );

  const takes: Take[] = [];
  for (const [i, result] of settled.entries()) {
    if (result.status === "fulfilled") {
      if (result.value.text.trim().startsWith(HALT_TOKEN)) {
        emit({ type: "halt", reason: "voice-flagged-risk" });
        return;
      }
      takes.push(result.value);
    } else {
      emit({
        type: "notice",
        message: `${seatedVoices[i].name} could not answer this one, so the panel carried on without them.`,
      });
      emit({ type: "take-end", voiceId: seatedVoices[i].id });
    }
  }

  if (takes.length < 2) {
    throw new Error("Not enough of the panel could answer to hold a discussion.");
  }

  emit({ type: "stage", stage: "cross-talk" });
  const exchanges = await planCrossTalk(takes, signal).catch(() => []);
  const challengeResults = await Promise.allSettled(
    exchanges.map((e) => crossTalk(e, takes, request, emit, signal)),
  );
  const challenges = challengeResults
    .filter(
      (r): r is PromiseFulfilledResult<{ voiceId: VoiceId; targetId: VoiceId; text: string }> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value)
    .filter((c) => !c.text.trim().startsWith(HALT_TOKEN));

  emit({ type: "stage", stage: "summing-up" });
  const synthesis = await synthesise(request, panel, takes, challenges, signal);
  emit({ type: "synthesis", synthesis });

  emit({ type: "stage", stage: "done" });
  emit({ type: "done" });
}

export { RefusalError };
