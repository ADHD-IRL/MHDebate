"use client";

import { useState } from "react";
import { renderPdf } from "@/lib/pdf";
import { buildClinicalReport, renderReportText, reportFilename, type Block } from "@/lib/report";
import { screen } from "@/lib/safety";
import type { Challenge, ClinicalSummary, PanelChoice, PanelRequest, Synthesis, Take } from "@/lib/types";

/** Renders the same block list the PDF does, so preview and file cannot drift. */
function ReportPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3 text-[0.9rem] leading-relaxed">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "title":
            return (
              <h3 key={i} className="font-display text-xl">
                {block.text}
              </h3>
            );
          case "meta":
            return (
              <p key={i} className="text-xs text-muted">
                {block.text}
              </p>
            );
          case "banner":
            return (
              <div key={i} className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-xs">
                {block.lines.map((line, j) => (
                  <p key={j} className={j === 0 ? "font-semibold" : "mt-0.5"}>
                    {line}
                  </p>
                ))}
              </div>
            );
          case "heading":
            return (
              <h4 key={i} className="pt-2 font-semibold">
                {block.text}
              </h4>
            );
          case "subheading":
            return (
              <h5 key={i} className="pt-1 text-[0.9rem] font-medium text-muted">
                {block.text}
              </h5>
            );
          case "paragraph":
            return <p key={i}>{block.text}</p>;
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-accent pl-3 italic">
                {block.text}
              </blockquote>
            );
          case "bullets":
            return (
              <ul key={i} className="ml-1 space-y-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span aria-hidden className="text-muted">
                      –
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "rule":
            return <hr key={i} className="border-line" />;
          default:
            return null;
        }
      })}
    </div>
  );
}

export function ShareWithDoctor({
  request,
  panel,
  takes,
  challenges,
  synthesis,
  demoSlug,
}: {
  request: PanelRequest;
  panel: PanelChoice | null;
  takes: Take[];
  challenges: Challenge[];
  synthesis: Synthesis | null;
  demoSlug?: string;
}) {
  const [clinical, setClinical] = useState<ClinicalSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generatedAt = new Date();
  const risk = screen(request.question);

  const doc = clinical
    ? buildClinicalReport({
        request,
        panel,
        clinical,
        riskLevel: risk.level,
        riskTopics: risk.topics,
        generatedAt,
      })
    : null;

  async function prepare() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/clinical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, panel, takes, challenges, synthesis, demoSlug }),
      });
      const payload = (await response.json()) as { clinical?: ClinicalSummary; error?: string };
      if (payload.clinical) setClinical(payload.clinical);
      else setError(payload.error ?? "Could not put the notes together.");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!doc) return;
    // Built here in the browser: the finished document is never uploaded.
    const blob = new Blob([renderPdf(doc) as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = reportFilename(generatedAt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    if (!doc) return;
    try {
      await navigator.clipboard.writeText(renderReportText(doc));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Your browser blocked the clipboard. Use the PDF instead.");
    }
  }

  if (!doc) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-display text-lg">Taking this to an appointment?</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          This can rewrite the discussion as one page of notes for a clinician: your own words
          quoted exactly, what you reported, and the questions worth asking — in the order a history
          usually gets taken. It names no diagnosis, and it says on the page that it was written by
          an AI tool from a few sentences.
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted">
          The PDF is built in your browser and never uploaded.
        </p>

        {error ? <p className="mt-3 max-w-prose text-sm text-warn">{error}</p> : null}

        <button
          type="button"
          onClick={prepare}
          disabled={busy}
          className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[rgb(var(--surface))] disabled:opacity-50"
        >
          {busy ? "Writing the notes…" : "Prepare notes for an appointment"}
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg">Notes for an appointment</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-[rgb(var(--surface))]"
          >
            Download PDF
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-full border border-line px-4 py-2 text-sm transition-colors hover:border-accent"
          >
            {copied ? "Copied" : "Copy as text"}
          </button>
        </div>
      </div>

      <p className="max-w-prose text-sm text-muted">
        Read it before you hand it over. If anything in it is wrong, cross it out — it was written
        from a few sentences, and you are the one who knows.
      </p>

      {error ? <p className="max-w-prose text-sm text-warn">{error}</p> : null}

      <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-line bg-canvas p-5">
        <ReportPreview blocks={doc.blocks} />
      </div>
    </section>
  );
}
