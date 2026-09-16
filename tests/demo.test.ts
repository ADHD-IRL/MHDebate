import { describe, expect, it } from "vitest";
import { DEMOS, demoBySlug } from "@/lib/demo";
import { normaliseSynthesis } from "@/lib/engine";
import { screen } from "@/lib/safety";
import { namesADiagnosis, normaliseClinical } from "@/lib/clinical";
import { VOICES } from "@/lib/voices";
import { supportLabel } from "@/components/SynthesisView";

describe("worked examples", () => {
  it("has unique slugs and can be looked up", () => {
    const slugs = DEMOS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(demoBySlug(slugs[0])?.slug).toBe(slugs[0]);
    expect(demoBySlug("nope")).toBeUndefined();
  });

  it("only references voices that exist", () => {
    for (const demo of DEMOS) {
      for (const seat of [...demo.panel.seated, ...demo.panel.notSeated]) {
        expect(VOICES[seat.id]).toBeDefined();
      }
      for (const take of demo.takes) expect(VOICES[take.voiceId]).toBeDefined();
      for (const c of demo.challenges) {
        expect(VOICES[c.voiceId]).toBeDefined();
        expect(VOICES[c.targetId]).toBeDefined();
        expect(c.voiceId).not.toBe(c.targetId);
      }
    }
  });

  it("only gives takes to voices that were seated", () => {
    for (const demo of DEMOS) {
      const seated = new Set(demo.panel.seated.map((s) => s.id));
      for (const take of demo.takes) expect(seated.has(take.voiceId)).toBe(true);
    }
  });

  it("survives the same normalisation a live synthesis goes through", () => {
    for (const demo of DEMOS) {
      const cleaned = normaliseSynthesis(demo.synthesis, demo.takes);
      expect(cleaned.agreements.length).toBe(demo.synthesis.agreements.length);
      expect(cleaned.disagreements.length).toBe(demo.synthesis.disagreements.length);
    }
  });

  it("never ships an empty disagreement list", () => {
    // The whole point of the format: a tidy summary that resolved everything
    // would be the failure mode, not the success case.
    for (const demo of DEMOS) {
      expect(demo.synthesis.disagreements.length).toBeGreaterThan(0);
    }
  });

  it("ships clinician notes that name no diagnosis", () => {
    // These are hand-written, so the guard that protects model output does not
    // cover them. Same bar either way: nothing that reaches a clinician's desk
    // carries a label the patient never earned.
    for (const demo of DEMOS) {
      for (const area of demo.clinical.areasToExplore) {
        expect(namesADiagnosis(area.area)).toBe(false);
      }
      expect(normaliseClinical(demo.clinical).areasToExplore).toHaveLength(
        demo.clinical.areasToExplore.length,
      );
      expect(demo.clinical.reasonForContact.length).toBeGreaterThan(10);
    }
  });

  it("uses example questions that pass the safety screen", () => {
    for (const demo of DEMOS) {
      expect(screen(demo.question).level).toBe("clear");
    }
  });
});

describe("supportLabel", () => {
  it("never implies more agreement than there was", () => {
    expect(supportLabel(1, 5)).toBe("One voice");
    expect(supportLabel(5, 5)).toBe("Every voice");
    expect(supportLabel(2, 5)).toBe("2 of 5 voices");
    expect(supportLabel(4, 5)).toBe("Most of the panel (4 of 5)");
  });

  it("degrades quietly when the panel size is unknown", () => {
    expect(supportLabel(2, 0)).toBe("");
  });
});
