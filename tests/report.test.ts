import { describe, expect, it } from "vitest";
import { namesADiagnosis, normaliseClinical } from "@/lib/clinical";
import {
  buildClinicalReport,
  renderReportText,
  reportFilename,
  safetyNote,
  type ReportInput,
} from "@/lib/report";
import { measure, renderPdf, toWinAnsi, wrap } from "@/lib/pdf";
import type { ClinicalSummary } from "@/lib/types";

export const CLINICAL: ClinicalSummary = {
  reasonForContact:
    "Longstanding difficulty initiating tasks, worse over the past year, now affecting work output.",
  history: [
    "Reports difficulty since school; describes it as constant rather than episodic.",
    "Marked worsening reported after moving to fully remote work approximately one year ago.",
    "No prior assessment or treatment reported.",
  ],
  functionalImpact: [
    "Reports losing up to four hours at a time before starting work with a deadline the following day.",
    "Describes distress and self-criticism during these periods.",
  ],
  triedAlready: [],
  areasToExplore: [
    {
      area: "Task initiation versus sustained attention, longstanding",
      whyRaised:
        "Patient locates the difficulty at starting rather than at continuing once started; panel treated this distinction as central.",
      discriminators: [
        "Whether difficulty persists once a task is underway, or resolves after the first few minutes.",
        "Whether the pattern appears with low-stakes and enjoyable tasks as well as obligations.",
      ],
    },
    {
      area: "Response to external structure",
      whyRaised: "Reported deterioration coincides with removal of workplace structure.",
      discriminators: [
        "Whether working alongside others restores function.",
        "Whether the change was accompanied by reduced social contact or mood change.",
      ],
    },
    {
      area: "Mood and energy over the same period",
      whyRaised: "Timing overlaps with an isolating change; not screened for in the account.",
      discriminators: ["Sleep, appetite, anhedonia, and diurnal variation over the last year."],
    },
  ],
  worthExcluding: [
    "Sleep quality and duration, given the reported timing.",
    "Ferritin, B12, thyroid function, if not checked recently.",
  ],
  whatTheyreAskingFor: [
    "An explanation for a pattern they describe as lifelong.",
    "Inferred, not stated: to be taken seriously rather than advised to try harder.",
  ],
};

const INPUT: ReportInput = {
  request: {
    question:
      "I can't start tasks even when I genuinely care about them and the deadline is tomorrow. I'll sit there for four hours doing nothing and hating myself. It's been like this since school but it got much worse after I started working from home.",
    about: "me",
    includeMeaningVoice: false,
  },
  panel: { framing: "Why starting is hard even when you care.", seated: [], notSeated: [] },
  clinical: CLINICAL,
  riskLevel: "clear",
  riskTopics: [],
  generatedAt: new Date("2026-03-14T10:00:00Z"),
};

describe("namesADiagnosis", () => {
  it("catches the labels the prompt forbids", () => {
    for (const text of [
      "ADHD",
      "possible adhd, inattentive type",
      "query OCD",
      "autism spectrum",
      "Major depressive disorder",
      "features of BPD",
      "generalised anxiety disorder",
    ]) {
      expect(namesADiagnosis(text)).toBe(true);
    }
  });

  it("does not fire on ordinary clinical description", () => {
    for (const text of [
      "Task initiation versus sustained attention, longstanding",
      "Response to external structure",
      "Sleep, appetite, and diurnal variation",
      "Address the bedtime routine",
      "Additional history from a partner would help",
      "Mood and energy over the same period",
    ]) {
      expect(namesADiagnosis(text)).toBe(false);
    }
  });
});

describe("normaliseClinical", () => {
  it("drops an area that arrived carrying a label", () => {
    const result = normaliseClinical({
      ...CLINICAL,
      areasToExplore: [
        ...CLINICAL.areasToExplore,
        { area: "Probable ADHD", whyRaised: "fits", discriminators: ["x"] },
      ],
    });
    expect(result.areasToExplore.map((a) => a.area)).not.toContain("Probable ADHD");
    expect(result.areasToExplore).toHaveLength(3);
  });

  it("survives a response missing whole sections", () => {
    const result = normaliseClinical({} as ClinicalSummary);
    expect(result.areasToExplore).toEqual([]);
    expect(result.history).toEqual([]);
    expect(result.reasonForContact).toBe("");
  });
});

describe("safetyNote", () => {
  it("always says it was a keyword screen, not an assessment", () => {
    for (const level of ["clear", "sensitive", "concern", "crisis"] as const) {
      expect(safetyNote(level, ["suicide"])).toMatch(/not a risk assessment/i);
    }
  });

  it("tells the clinician what was flagged and what the patient saw", () => {
    expect(safetyNote("concern", ["suicide"])).toMatch(/crisis resources were shown/i);
    expect(safetyNote("sensitive", ["eating"])).toContain("eating");
    expect(safetyNote("clear", [])).toMatch(/no crisis indicators/i);
  });
});

describe("buildClinicalReport", () => {
  const doc = buildClinicalReport(INPUT);

  it("leads with a warning before any content", () => {
    const bannerIndex = doc.blocks.findIndex((b) => b.kind === "banner");
    const firstHeading = doc.blocks.findIndex((b) => b.kind === "heading");
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeLessThan(firstHeading);
  });

  it("reproduces the patient's words verbatim", () => {
    const quote = doc.blocks.find((b) => b.kind === "quote");
    expect(quote && "text" in quote ? quote.text : "").toBe(INPUT.request.question);
  });

  it("states on the page that it is not a clinical document", () => {
    const text = renderReportText(doc);
    expect(text).toMatch(/NOT A CLINICAL DOCUMENT/);
    expect(text).toMatch(/no diagnosis is offered or implied/i);
    expect(text).toMatch(/not a referral/i);
    expect(text).toMatch(/Not a differential/i);
  });

  it("carries the footer disclaimer on every page of the PDF", () => {
    expect(doc.footer).toMatch(/not a clinical document/i);
  });

  it("omits sections the summary left empty rather than printing blank headings", () => {
    const text = renderReportText(doc);
    // triedAlready is empty in the fixture.
    expect(text).not.toMatch(/ALREADY TRIED/);
    expect(text).toMatch(/HISTORY AS REPORTED/);
  });

  it("says why there is no differential", () => {
    expect(renderReportText(doc)).toMatch(/rather than as a differential/i);
  });

  it("names the file without naming the person", () => {
    expect(reportFilename(INPUT.generatedAt)).toBe("appointment-notes-2026-03-14.pdf");
  });
});

describe("pdf text handling", () => {
  it("maps typographic characters into WinAnsi", () => {
    expect(toWinAnsi("don’t — “quoted”…")).toBe(`don't - "quoted"...`);
  });

  it("replaces characters it cannot encode rather than emitting noise", () => {
    expect(toWinAnsi("emoji \u{1F600} here")).toContain("?");
  });

  it("measures bold wider than regular for the same string", () => {
    expect(measure("Handling", 10, true)).toBeGreaterThan(measure("Handling", 10, false));
  });

  it("wraps inside the given width", () => {
    const lines = wrap("the quick brown fox jumps over the lazy dog ".repeat(6), 9.5, 200);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line, 9.5)).toBeLessThanOrEqual(200);
  });

  it("hard-breaks a token longer than the line", () => {
    const lines = wrap("x".repeat(400), 9.5, 120);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measure(line, 9.5)).toBeLessThanOrEqual(120);
  });
});

describe("renderPdf", () => {
  const bytes = renderPdf(buildClinicalReport(INPUT));
  const text = Buffer.from(bytes).toString("latin1");

  it("produces a file a viewer will accept", () => {
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/BaseFont /Helvetica-Bold");
  });

  it("writes an xref entry per object, with correct byte offsets", () => {
    const size = Number(/\/Size (\d+)/.exec(text)?.[1]);
    const entries = text.slice(text.indexOf("xref")).match(/^\d{10} \d{5} [nf] $/gm) ?? [];
    expect(entries).toHaveLength(size);

    // Each offset must land exactly on its own "N 0 obj" header, or viewers
    // that trust the table instead of rebuilding it will fail to open the file.
    const offsets = entries.slice(1).map((line) => Number(line.slice(0, 10)));
    offsets.forEach((offset, index) => {
      expect(text.slice(offset, offset + 12)).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });

    const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
  });

  it("declares a stream length matching the bytes actually written", () => {
    const declared = [...text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)].map((m) => Number(m[1]));
    const actual = [...text.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map(
      (m) => Buffer.from(m[1], "latin1").length,
    );
    expect(declared).toEqual(actual);
  });

  it("escapes parentheses so they cannot terminate a string early", () => {
    const tricky = renderPdf(
      buildClinicalReport({
        ...INPUT,
        request: { ...INPUT.request, question: "I feel (mostly) fine \\ sometimes" },
      }),
    );
    const body = Buffer.from(tricky).toString("latin1");
    expect(body).toContain("\\(mostly\\)");
    expect(body).toContain("\\\\");
  });

  it("paginates a long report and numbers every page", () => {
    const long = buildClinicalReport({
      ...INPUT,
      clinical: {
        ...CLINICAL,
        history: Array.from({ length: 6 }, (_, i) => `History line ${i}. `.repeat(14)),
        functionalImpact: Array.from({ length: 5 }, (_, i) => `Impact line ${i}. `.repeat(14)),
        areasToExplore: Array.from({ length: 6 }, (_, i) => ({
          area: `Area number ${i}`,
          whyRaised: "Because of a reported pattern. ".repeat(10),
          discriminators: ["A discriminating feature. ".repeat(8)],
        })),
      },
    });
    const body = Buffer.from(renderPdf(long)).toString("latin1");
    const pageCount = Number(/\/Count (\d+)/.exec(body)?.[1]);
    expect(pageCount).toBeGreaterThan(1);
    expect(body).toContain(`page 1 of ${pageCount}`);
    expect(body).toContain(`page ${pageCount} of ${pageCount}`);
  });
});
