import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works — MHDebate",
  description:
    "What the panel actually does, what it deliberately refuses to do, and why agreement between the voices is weak evidence.",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="max-w-prose space-y-3 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <h1 className="font-display text-4xl tracking-tight">How it works</h1>
        <p className="max-w-prose text-lg leading-relaxed text-muted">
          Four stages, in order, with one deliberate constraint in each. The constraints are the
          product — without them this is just a chatbot writing in different fonts.
        </p>
      </header>

      <ol className="grid gap-4 sm:grid-cols-2">
        {[
          {
            n: "01",
            title: "Choosing who to ask",
            body: "The panel is assembled from your question, not from a standing roster. It also records who it left out and why — the thing that stops every question quietly getting the same five voices.",
          },
          {
            n: "02",
            title: "First takes",
            body: "Every seated voice answers at the same time, in a separate request, with no sight of the others. This is real isolation rather than an instruction to pretend, which is why the first round produces genuinely different readings.",
          },
          {
            n: "03",
            title: "Cross-talk",
            body: "Now they read each other. Each push-back has to name the specific claim it disputes and something you could actually notice that would settle it. A disagreement with no way to check it doesn't earn its place.",
          },
          {
            n: "04",
            title: "Summing up",
            body: "Agreements and unresolved disagreements, given equal billing. A summary that quietly resolves a real split to look tidier has taken information away from you.",
          },
        ].map((step) => (
          <li key={step.n} className="rounded-2xl border border-line bg-surface p-5">
            <span className="font-mono text-xs text-accent">{step.n}</span>
            <h2 className="mt-1 font-display text-lg">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      <Block title="Why agreement here means less than it looks">
        <p>
          Every voice on the panel is produced by the same underlying AI model. They have the same
          training, the same gaps, and the same tendencies. When five of them agree, that is much
          closer to asking one source five times than to asking five sources once.
        </p>
        <p>
          So the app reports plain counts — <span className="italic">three of five voices</span> —
          and refuses to dress them up as a confidence score. A number with a decimal point would
          imply a precision that does not exist here. Treat convergence as a hint about where to
          look, and treat the disagreements as the more informative half of the page.
        </p>
      </Block>

      <Block title="What it will not do">
        <ul className="ml-5 list-disc space-y-2">
          <li>
            Tell you what you have. The voices are instructed to describe what a pattern can come
            from and what separates the possibilities, never to land on a label for you.
          </li>
          <li>
            Discuss specific medication, dosing, or stopping a treatment you are on. That belongs
            with the person who prescribed it.
          </li>
          <li>
            Run at all if what you wrote suggests immediate danger. It shows{" "}
            <Link href="/support" className="text-accent underline underline-offset-2">
              crisis lines
            </Link>{" "}
            instead. For serious-but-not-urgent subjects it shows resources first and then lets you
            decide whether to carry on — a tool that dead-ends on the word "suicide" helps nobody,
            least of all the person who typed it.
          </li>
        </ul>
      </Block>

      <Block title="What happens to what you write">
        <p>
          Your question is sent to Anthropic's API to generate the discussion, and that is the whole
          journey. There is no account, no database, and no server-side log of what you asked. Close
          the tab and it is gone — including from this page, which keeps nothing.
        </p>
        <p>
          That also means there is nothing to come back to. If a debate is useful, copy it somewhere
          before you leave.
        </p>
      </Block>

      <Block title="Where this came from">
        <p>
          The architecture is a consumer translation of a clinician-facing panel-review system: a
          sixty-three-agent subject-matter roster, convened per case, with the independent first
          pass hash-sealed before cross-examination and eighteen deterministic validators gating
          release. That system is built for a licensed clinician reviewing a case file.
        </p>
        <p>
          What survived the translation is every property that protects the reader — no standing
          panel, independence before interaction, dissent kept structurally, honest accounting of
          how much agreement is worth, safety routing before any model call. What went is
          everything that only makes sense inside a clinic: the audit trail, the release gate, the
          survey-sampling arithmetic. The{" "}
          <Link href="/voices" className="text-accent underline underline-offset-2">
            panel page
          </Link>{" "}
          lists which of the original sixty-three roles each voice stands in for.
        </p>
      </Block>

      <Block title="If you are using this seriously">
        <p>
          Take two lines of a debate to someone who can ask you questions back. The most useful
          output here is usually not the summary but the{" "}
          <span className="italic">things you could notice</span> list — observations that would
          separate the explanations on the table, which is exactly the material a good appointment
          runs on and exactly what people find hardest to produce on the spot.
        </p>
      </Block>
    </div>
  );
}
