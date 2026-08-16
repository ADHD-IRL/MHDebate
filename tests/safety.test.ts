import { describe, expect, it } from "vitest";
import { isBlocking, needsAcknowledgement, screen, supportFor } from "@/lib/safety";

describe("screen — crisis", () => {
  it("blocks an explicit statement of current intent", () => {
    expect(screen("I am going to kill myself tonight").level).toBe("crisis");
    expect(screen("i want to die and i have a plan").level).toBe("crisis");
    expect(screen("I've taken all the pills in the cabinet").level).toBe("crisis");
  });

  it("is not fooled by the curly apostrophe a phone inserts", () => {
    expect(screen("I’ve taken all the pills").level).toBe("crisis");
    expect(screen("I don’t want to be here anymore").level).toBe("concern");
  });

  it("blocks stated intent to harm another person", () => {
    expect(screen("I am going to hurt my brother").level).toBe("crisis");
  });

  it("is blocking only at the crisis level", () => {
    expect(isBlocking(screen("I am going to kill myself"))).toBe(true);
    expect(isBlocking(screen("my friend talks about suicide a lot"))).toBe(false);
  });
});

describe("screen — concern", () => {
  it("flags the subject without stated intent", () => {
    const result = screen("My brother keeps saying he wants to die and I don't know what to do");
    expect(result.level).toBe("concern");
    expect(result.topics).toContain("suicide");
  });

  it("flags self-harm mentioned in the third person", () => {
    expect(screen("I found out my daughter has been cutting herself").level).toBe("concern");
  });

  it("routes first-person and third-person the same way", () => {
    // Both readers need the resources, so both take the same path.
    expect(screen("I self-harm when I'm overwhelmed").level).toBe("concern");
    expect(screen("she self-harms when she's overwhelmed").level).toBe("concern");
  });

  it("asks for acknowledgement rather than blocking", () => {
    const result = screen("I want to understand why suicidal thoughts happen");
    expect(needsAcknowledgement(result)).toBe(true);
    expect(isBlocking(result)).toBe(false);
  });
});

describe("screen — sensitive", () => {
  it("lets serious topics through with a care note", () => {
    for (const text of [
      "I think my partner might have an eating disorder",
      "My dad started hearing voices last year",
      "I drink every day to cope with work",
      "My ex was emotionally abusive and I'm still jumpy",
    ]) {
      const result = screen(text);
      expect(result.level).toBe("sensitive");
      expect(isBlocking(result)).toBe(false);
      expect(needsAcknowledgement(result)).toBe(false);
    }
  });

  it("returns topic-specific support lines", () => {
    const lines = supportFor(screen("I binge eat most evenings"));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => /Beat|ANAD|Helpline/i.test(l.name))).toBe(true);
  });
});

describe("screen — clear", () => {
  it("does not trip on ordinary questions", () => {
    for (const text of [
      "I can't start tasks even when I care about them and the deadline is tomorrow",
      "My brain loops on the same worry for hours and I google for reassurance",
      "After social events I'm wiped out for two days even though I enjoyed them",
      "Why do I feel so restless in meetings",
      "I read that ADHD rates have gone up a lot recently",
    ]) {
      expect(screen(text).level).toBe("clear");
    }
  });

  it("does not treat an ordinary tired phrase as a crisis", () => {
    expect(screen("I'm dead tired and this deadline is killing me").level).toBe("clear");
  });

  it("takes the highest level when several rules match", () => {
    const result = screen("I am going to kill myself, and I've also been restricting food");
    expect(result.level).toBe("crisis");
    expect(result.topics).toEqual(expect.arrayContaining(["suicide", "eating"]));
  });
});
