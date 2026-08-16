/**
 * The safety screen runs before any model call, on the client for instant
 * feedback and again on the server so it cannot be skipped.
 *
 * It grades into four levels rather than the single halt a clinician-facing
 * tool can get away with. A consumer app that dead-ends the moment someone
 * types the word "suicide" helps nobody: the person most in need of resources
 * gets a locked door, and someone trying to understand a friend's diagnosis
 * gets treated as an emergency. So:
 *
 *   crisis    — explicit current intent, plan, or means. Resources only.
 *               No debate, no bypass.
 *   concern   — the subject is present but without stated current intent.
 *               Resources first, then an informed choice to continue.
 *   sensitive — a serious topic that deserves a care note alongside the
 *               debate, not instead of it.
 *   clear     — proceed.
 *
 * Both directions matter: "I want to hurt myself" and "my brother says he
 * wants to die" route the same way, because the reader needs help either way.
 */

export type RiskLevel = "clear" | "sensitive" | "concern" | "crisis";

export interface RiskResult {
  level: RiskLevel;
  /** Which category tripped, for choosing which resources to surface. */
  topics: RiskTopic[];
}

export type RiskTopic =
  | "suicide"
  | "self-harm"
  | "harm-to-others"
  | "abuse"
  | "eating"
  | "psychosis"
  | "substances";

interface Rule {
  topic: RiskTopic;
  level: Exclude<RiskLevel, "clear">;
  patterns: RegExp[];
}

/**
 * Explicit statements of current intent, plan, or means. These are deliberately
 * narrow: they require an intent verb next to the act, so that "I read about
 * suicide rates" does not match but "I am going to kill myself" does.
 */
const CRISIS_RULES: Rule[] = [
  {
    topic: "suicide",
    level: "crisis",
    patterns: [
      /\b(?:i|we)(?:'m| am| are)?\s+(?:going to|gonna|about to|planning to|plan to)\s+(?:kill|end|off)\s+(?:myself|my life|ourselves|it all)\b/i,
      /\bi\s+(?:want|need|intend|decided|am ready)\s+to\s+(?:die|kill myself|end (?:it|my life)|not (?:be here|wake up))\b/i,
      /\bi\s+(?:have|'ve|ve)\s+(?:a|the)\s+(?:plan|method|means)\s+to\s+(?:die|kill myself|end (?:it|my life))\b/i,
      /\bi\s+(?:am|'m|m)\s+going to\s+(?:jump|overdose|hang myself|shoot myself)\b/i,
      /\btonight\s+(?:is|will be)\s+(?:the|my)\s+(?:night|last night|end)\b/i,
      /\b(?:i|we)\s*(?:'ve|\s+have)?\s*(?:took|taken)\s+(?:all|a bottle of|too many|the whole)\s+(?:the\s+|of the\s+)?(?:pills|tablets|bottle)\b/i,
      /\bsuicide\s+(?:note|plan)\b/i,
    ],
  },
  {
    topic: "harm-to-others",
    level: "crisis",
    patterns: [
      /\bi\s+(?:am|'m|m)?\s*(?:going to|gonna|planning to|plan to|want to)\s+(?:kill|shoot|stab|attack|hurt)\s+(?:him|her|them|someone|somebody|my|the)\b/i,
      /\bi\s+(?:have|'ve)\s+(?:a|the)\s+(?:gun|knife|weapon)\s+(?:and|ready)\b/i,
    ],
  },
];

/**
 * The subject is present, but nothing states current intent. These earn a
 * resources-first interstitial with an informed way to continue.
 */
const CONCERN_RULES: Rule[] = [
  {
    topic: "suicide",
    level: "concern",
    patterns: [
      /\bsuicid/i,
      /\bkill(?:ing)?\s+(?:myself|himself|herself|themselves|themself)\b/i,
      /\bend(?:ing)?\s+(?:my|his|her|their)\s+(?:own\s+)?life\b/i,
      /\btake\s+(?:my|his|her|their)\s+own\s+life\b/i,
      /\b(?:want|wants|wanted|wanting)\s+to\s+die\b/i,
      /\bbetter\s+off\s+(?:dead|without me)\b/i,
      /\bno\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|going on|carrying on)\b/i,
      /\bdon'?t\s+want\s+to\s+(?:be here|wake up|exist)\b/i,
    ],
  },
  {
    topic: "self-harm",
    level: "concern",
    patterns: [
      /\bself[\s-]?harm/i,
      /\bcut(?:s|ting)?\s+(?:myself|himself|herself|themselves|themself)\b/i,
      /\bburn(?:s|ing)?\s+(?:myself|himself|herself|themselves)\b/i,
      /\bhurt(?:s|ing)?\s+(?:myself|himself|herself|themselves|themself)\s+(?:on purpose|deliberately|to cope)\b/i,
      /\boverdos(?:e|ed|ing)\b/i,
    ],
  },
  {
    topic: "harm-to-others",
    level: "concern",
    patterns: [
      /\bhomicid/i,
      /\bhurt(?:ing)?\s+(?:someone|somebody|other people|others|my (?:kids|children|child|baby|partner))\b/i,
    ],
  },
];

/**
 * Serious topics that deserve a care note beside the debate rather than
 * instead of it. Blocking these would break the app for exactly the people
 * trying to understand them.
 */
const SENSITIVE_RULES: Rule[] = [
  {
    topic: "abuse",
    level: "sensitive",
    patterns: [
      /\b(?:physically|sexually|emotionally)\s+abus/i,
      /\bdomestic\s+(?:abuse|violence)\b/i,
      /\b(?:hits|hit|beats|beat|chokes|choked|threatens|threatened)\s+me\b/i,
      /\bcoercive\s+control\b/i,
      /\b(?:child|elder)\s+(?:abuse|neglect)\b/i,
      /\bassault(?:ed)?\b/i,
    ],
  },
  {
    topic: "eating",
    level: "sensitive",
    patterns: [
      /\banorexi|\bbulimi|\beating\s+disorder\b/i,
      /\bpurg(?:e|es|ing)\b/i,
      /\brestrict(?:ing|ed)?\s+(?:food|calories|eating|my intake)\b/i,
      /\bbinge\s+(?:eat|eating)\b/i,
      /\bnot\s+(?:been\s+)?eating\b/i,
      /\bstarv(?:e|ing)\s+(?:myself|himself|herself|themselves)\b/i,
    ],
  },
  {
    topic: "psychosis",
    level: "sensitive",
    patterns: [
      /\bpsychosis|\bpsychotic\b/i,
      /\bhallucinat/i,
      /\bhearing\s+voices\b/i,
      /\bdelusion/i,
      /\bparanoi(?:a|d)\b/i,
    ],
  },
  {
    topic: "substances",
    level: "sensitive",
    patterns: [
      /\b(?:alcohol|drug|opioid|heroin|cocaine|meth)\s+(?:addiction|dependence|problem|abuse)\b/i,
      /\bwithdraw(?:al|ing)\s+(?:from|symptoms)\b/i,
      /\brelapse[ds]?\b/i,
      /\bdrink(?:ing)?\s+(?:every day|to cope|too much)\b/i,
    ],
  },
];

const LEVEL_ORDER: Record<RiskLevel, number> = {
  clear: 0,
  sensitive: 1,
  concern: 2,
  crisis: 3,
};

/**
 * Phones produce curly apostrophes, and every contraction in the rules above
 * is written with a straight one. Normalising here rather than doubling every
 * pattern keeps the rules readable and closes a gap that would otherwise let
 * "I've taken all the pills" through on an iPhone but not on a laptop.
 */
function normalise(text: string): string {
  return text.replace(/[‘’ʼ´]/g, "'");
}

/** Grade a free-text question. Pure, synchronous, and safe to run on keystroke. */
export function screen(input: string): RiskResult {
  const text = normalise(input);
  const topics = new Set<RiskTopic>();
  let level: RiskLevel = "clear";

  for (const rule of [...CRISIS_RULES, ...CONCERN_RULES, ...SENSITIVE_RULES]) {
    if (rule.patterns.some((p) => p.test(text))) {
      topics.add(rule.topic);
      if (LEVEL_ORDER[rule.level] > LEVEL_ORDER[level]) level = rule.level;
    }
  }

  return { level, topics: [...topics] };
}

/** True when the debate must not run at all. */
export function isBlocking(result: RiskResult): boolean {
  return result.level === "crisis";
}

/** True when the reader must see resources and choose before the debate runs. */
export function needsAcknowledgement(result: RiskResult): boolean {
  return result.level === "concern";
}

export interface SupportLine {
  region: string;
  name: string;
  contact: string;
  note?: string;
}

/**
 * Deliberately short and international. A wall of numbers is not usable by
 * someone in distress; four entries plus a global directory is.
 */
export const CRISIS_LINES: SupportLine[] = [
  {
    region: "Anywhere",
    name: "Emergency services",
    contact: "999 (UK) · 911 (US/CA) · 112 (EU) · 000 (AU)",
    note: "If someone is in immediate physical danger.",
  },
  {
    region: "US & Canada",
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
    note: "24/7, free. Chat at 988lifeline.org.",
  },
  {
    region: "UK & Ireland",
    name: "Samaritans",
    contact: "Call 116 123",
    note: "24/7, free. Or email jo@samaritans.org.",
  },
  {
    region: "Australia",
    name: "Lifeline",
    contact: "Call 13 11 14",
    note: "24/7. Text 0477 13 11 14.",
  },
  {
    region: "US",
    name: "Crisis Text Line",
    contact: "Text HOME to 741741",
    note: "Text 686868 in Canada, 85258 in the UK.",
  },
  {
    region: "Everywhere else",
    name: "Find a Helpline",
    contact: "findahelpline.com",
    note: "Verified crisis lines in over 130 countries.",
  },
];

/** Extra resources shown alongside a debate that touched a sensitive topic. */
export const TOPIC_SUPPORT: Record<RiskTopic, SupportLine[]> = {
  suicide: [],
  "self-harm": [],
  "harm-to-others": [],
  abuse: [
    {
      region: "US",
      name: "National Domestic Violence Hotline",
      contact: "Call 1-800-799-7233 · text START to 88788",
    },
    { region: "UK", name: "Refuge / National DV Helpline", contact: "Call 0808 2000 247" },
    { region: "Everywhere", name: "Find a Helpline", contact: "findahelpline.com" },
  ],
  eating: [
    { region: "US", name: "ANAD Helpline", contact: "Call 1-888-375-7767" },
    { region: "UK", name: "Beat Eating Disorders", contact: "Call 0808 801 0677" },
    { region: "Everywhere", name: "Find a Helpline", contact: "findahelpline.com" },
  ],
  psychosis: [
    {
      region: "Everywhere",
      name: "Early intervention matters here",
      contact: "Speak to a GP or local mental health service soon",
      note: "First-episode psychosis services exist in most countries and outcomes are better the earlier they start.",
    },
  ],
  substances: [
    { region: "US", name: "SAMHSA National Helpline", contact: "Call 1-800-662-4357" },
    { region: "UK", name: "FRANK", contact: "Call 0300 123 6600" },
    { region: "Everywhere", name: "Find a Helpline", contact: "findahelpline.com" },
  ],
};

export function supportFor(result: RiskResult): SupportLine[] {
  const seen = new Set<string>();
  const out: SupportLine[] = [];
  for (const topic of result.topics) {
    for (const line of TOPIC_SUPPORT[topic] ?? []) {
      const key = `${line.name}|${line.contact}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
  }
  return out;
}
