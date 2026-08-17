import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PanelEvent } from "@/lib/types";

/**
 * The model layer is stubbed so the orchestration — parallel first takes,
 * pairing, cross-talk, synthesis, and the halt paths — is verified without a
 * key or a network call. This is the part most likely to break silently.
 */
const streamProse = vi.fn();
const structured = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  streamProse: (...args: unknown[]) => streamProse(...args),
  structured: (...args: unknown[]) => structured(...args),
  RefusalError: class RefusalError extends Error {},
}));

const { runPanel } = await import("@/lib/engine");

const PANEL = {
  framing: "Restated neutrally.",
  seated: [
    { id: "clinician", reason: "a" },
    { id: "been-there", reason: "b" },
    { id: "careful-skeptic", reason: "c" },
    { id: "practical", reason: "d" },
  ],
  notSeated: [{ id: "body-doctor", reason: "not relevant" }],
};

const SYNTHESIS = {
  headline: "A headline",
  plainSummary: "Summary.",
  agreements: [{ point: "p", detail: "d", voices: ["clinician", "been-there"] }],
  disagreements: [
    {
      topic: "t",
      sideA: { voices: ["clinician"], position: "a" },
      sideB: { voices: ["been-there"], position: "b" },
      whatWouldSettleIt: "check this",
    },
  ],
  waysToTellApart: ["notice this"],
  questionsToAsk: ["ask this"],
  smallSteps: ["try this"],
  whatThisCannotTell: ["not this"],
};

/** structured() is called three times per run, in a fixed order. */
function structuredSequence(overrides: { synthesis?: unknown } = {}) {
  let call = 0;
  return async () => {
    call += 1;
    if (call === 1) return PANEL;
    if (call === 2) {
      return {
        exchanges: [{ from: "careful-skeptic", to: "clinician", about: "a real tension" }],
      };
    }
    return overrides.synthesis ?? SYNTHESIS;
  };
}

const request = { question: "Why can't I start things?", about: "me", includeMeaningVoice: false } as const;

async function collect(): Promise<PanelEvent[]> {
  const events: PanelEvent[] = [];
  await runPanel({ ...request }, (e) => events.push(e));
  return events;
}

beforeEach(() => {
  streamProse.mockReset();
  structured.mockReset();
});

describe("runPanel", () => {
  it("runs every stage in order and emits a synthesis", async () => {
    structured.mockImplementation(structuredSequence());
    streamProse.mockImplementation(async (call: { onDelta: (t: string) => void }) => {
      call.onDelta("some ");
      call.onDelta("text");
      return "some text";
    });

    const events = await collect();
    const stages = events.filter((e) => e.type === "stage").map((e) => (e as { stage: string }).stage);

    expect(stages).toEqual(["convening", "first-takes", "cross-talk", "summing-up", "done"]);
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(events.some((e) => e.type === "synthesis")).toBe(true);
    expect(events.filter((e) => e.type === "take-end")).toHaveLength(4);
    expect(events.filter((e) => e.type === "challenge-end")).toHaveLength(1);
  });

  it("writes every first take before any voice sees another", async () => {
    structured.mockImplementation(structuredSequence());

    // Each take resolves only once all four have started. If the engine ever
    // stopped running them in parallel, this deadlocks and the test times out.
    let started = 0;
    let release: () => void;
    const allStarted = new Promise<void>((resolve) => {
      release = resolve;
    });

    streamProse.mockImplementation(async (call: { user: string }) => {
      const isFirstRound = call.user.includes("Give your first read");
      if (isFirstRound) {
        started += 1;
        if (started === 4) release();
        await allStarted;
      }
      return "text";
    });

    const events = await collect();
    expect(events.filter((e) => e.type === "take-end")).toHaveLength(4);
  });

  it("stops the whole run if a voice raises the risk flag", async () => {
    structured.mockImplementation(structuredSequence());
    streamProse.mockResolvedValue("STOP-RISK");

    const events = await collect();
    expect(events.some((e) => e.type === "halt")).toBe(true);
    expect(events.some((e) => e.type === "synthesis")).toBe(false);
  });

  it("halts before any model call when the question describes a crisis", async () => {
    const events: PanelEvent[] = [];
    await runPanel(
      { ...request, question: "I am going to kill myself tonight" },
      (e) => events.push(e),
    );

    expect(events).toEqual([{ type: "halt", reason: "crisis" }]);
    expect(structured).not.toHaveBeenCalled();
    expect(streamProse).not.toHaveBeenCalled();
  });

  it("carries on when one voice fails, and says so", async () => {
    structured.mockImplementation(structuredSequence());
    let call = 0;
    streamProse.mockImplementation(async () => {
      call += 1;
      if (call === 2) throw new Error("upstream hiccup");
      return "text";
    });

    const events = await collect();
    expect(events.some((e) => e.type === "notice")).toBe(true);
    expect(events.some((e) => e.type === "synthesis")).toBe(true);
  });

  it("gives up rather than faking a debate when almost every voice fails", async () => {
    structured.mockImplementation(structuredSequence());
    let call = 0;
    streamProse.mockImplementation(async () => {
      call += 1;
      if (call > 1) throw new Error("upstream hiccup");
      return "text";
    });

    await expect(collect()).rejects.toThrow(/Not enough of the panel/);
  });

  it("still produces a summary when the pairing step fails", async () => {
    let call = 0;
    structured.mockImplementation(async () => {
      call += 1;
      if (call === 1) return PANEL;
      if (call === 2) throw new Error("pairing failed");
      return SYNTHESIS;
    });
    streamProse.mockResolvedValue("text");

    const events = await collect();
    expect(events.filter((e) => e.type === "challenge-start")).toHaveLength(0);
    expect(events.some((e) => e.type === "synthesis")).toBe(true);
  });
});
