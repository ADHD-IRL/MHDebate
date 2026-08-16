import { describe, expect, it } from "vitest";
import { normaliseExchanges, normalisePanel, normaliseSynthesis } from "@/lib/engine";
import { eligibleVoices, VOICES } from "@/lib/voices";
import type { PanelChoice, Synthesis, Take, VoiceId } from "@/lib/types";

const available = eligibleVoices({ about: "me", includeMeaningVoice: false });

function panel(seated: Array<{ id: string; reason: string }>, notSeated: typeof seated = []) {
  return { framing: "A question", seated, notSeated } as unknown as PanelChoice;
}

describe("normalisePanel", () => {
  it("drops ids the model invented", () => {
    const result = normalisePanel(
      panel([
        { id: "clinician", reason: "a" },
        { id: "the-wizard", reason: "b" },
        { id: "been-there", reason: "c" },
      ]),
      available,
    );
    expect(result.seated.map((s) => s.id)).not.toContain("the-wizard" as VoiceId);
    expect(result.seated.map((s) => s.id)).toContain("clinician");
  });

  it("drops voices that are not eligible for this request", () => {
    // The meaning voice is opt-in, so it must not appear when it wasn't asked for.
    const result = normalisePanel(
      panel([
        { id: "meaning", reason: "a" },
        { id: "clinician", reason: "b" },
      ]),
      available,
    );
    expect(result.seated.map((s) => s.id)).not.toContain("meaning" as VoiceId);
  });

  it("tops up an under-filled panel so a debate can still happen", () => {
    const result = normalisePanel(panel([{ id: "clinician", reason: "a" }]), available);
    expect(result.seated.length).toBeGreaterThanOrEqual(4);
  });

  it("caps an over-filled panel", () => {
    const result = normalisePanel(
      panel(available.map((v) => ({ id: v.id, reason: "everyone" }))),
      available,
    );
    expect(result.seated.length).toBeLessThanOrEqual(6);
  });

  it("de-duplicates, and never lists a seated voice as also excluded", () => {
    const result = normalisePanel(
      panel(
        [
          { id: "clinician", reason: "a" },
          { id: "clinician", reason: "again" },
          { id: "been-there", reason: "b" },
          { id: "practical", reason: "c" },
          { id: "careful-skeptic", reason: "d" },
        ],
        [{ id: "clinician", reason: "left out" }],
      ),
      available,
    );
    const seatedIds = result.seated.map((s) => s.id);
    expect(new Set(seatedIds).size).toBe(seatedIds.length);
    expect(result.notSeated.map((n) => n.id)).not.toContain("clinician" as VoiceId);
  });
});

describe("normaliseExchanges", () => {
  const takes: Take[] = [
    { voiceId: "clinician", text: "x" },
    { voiceId: "been-there", text: "y" },
  ];

  it("rejects a voice challenging itself", () => {
    const result = normaliseExchanges(
      [{ from: "clinician", to: "clinician", about: "itself" }],
      takes,
    );
    expect(result).toHaveLength(0);
  });

  it("rejects voices that never spoke", () => {
    const result = normaliseExchanges(
      [{ from: "clinician", to: "practical", about: "cost" }],
      takes,
    );
    expect(result).toHaveLength(0);
  });

  it("de-duplicates the same pairing in the same direction", () => {
    const result = normaliseExchanges(
      [
        { from: "clinician", to: "been-there", about: "one" },
        { from: "clinician", to: "been-there", about: "one again" },
        { from: "been-there", to: "clinician", about: "the other way" },
      ],
      takes,
    );
    expect(result).toHaveLength(2);
  });
});

describe("normaliseSynthesis", () => {
  const takes: Take[] = [
    { voiceId: "clinician", text: "x" },
    { voiceId: "been-there", text: "y" },
  ];

  const raw = {
    headline: "  A headline  ",
    plainSummary: "Some summary.",
    agreements: [
      { point: "Real", detail: "d", voices: ["clinician", "practical"] },
      { point: "Ghosts only", detail: "d", voices: ["practical"] },
    ],
    disagreements: [
      {
        topic: "Kept",
        sideA: { voices: ["clinician"], position: "a" },
        sideB: { voices: ["been-there"], position: "b" },
        whatWouldSettleIt: "check",
      },
      {
        topic: "Dropped — one side never spoke",
        sideA: { voices: ["clinician"], position: "a" },
        sideB: { voices: ["practical"], position: "b" },
        whatWouldSettleIt: "check",
      },
    ],
    waysToTellApart: ["one", "", "  "],
    questionsToAsk: ["ask this"],
    smallSteps: ["try this"],
    whatThisCannotTell: ["not this"],
  } as unknown as Synthesis;

  it("strips attributions to voices that never spoke", () => {
    const result = normaliseSynthesis(raw, takes);
    expect(result.agreements[0].voices).toEqual(["clinician"]);
  });

  it("drops items left with nobody behind them", () => {
    const result = normaliseSynthesis(raw, takes);
    expect(result.agreements).toHaveLength(1);
    expect(result.disagreements).toHaveLength(1);
    expect(result.disagreements[0].topic).toBe("Kept");
  });

  it("trims and drops empty list entries", () => {
    const result = normaliseSynthesis(raw, takes);
    expect(result.headline).toBe("A headline");
    expect(result.waysToTellApart).toEqual(["one"]);
  });

  it("survives a response missing whole sections", () => {
    const result = normaliseSynthesis({} as Synthesis, takes);
    expect(result.agreements).toEqual([]);
    expect(result.smallSteps).toEqual([]);
    expect(result.headline).toBe("");
  });
});

describe("voice roster", () => {
  it("keeps the meaning voice opt-in and the youth voice age-gated", () => {
    const adult = eligibleVoices({ about: "me", includeMeaningVoice: false }).map((v) => v.id);
    expect(adult).not.toContain("meaning");
    expect(adult).not.toContain("growing-up");

    const child = eligibleVoices({ about: "a-child-or-teen", includeMeaningVoice: true }).map(
      (v) => v.id,
    );
    expect(child).toContain("growing-up");
    expect(child).toContain("meaning");
  });

  it("gives every voice a blind spot and at least one source role", () => {
    for (const voice of Object.values(VOICES)) {
      expect(voice.blindSpot.length).toBeGreaterThan(10);
      expect(voice.sources.length).toBeGreaterThan(0);
    }
  });
});
