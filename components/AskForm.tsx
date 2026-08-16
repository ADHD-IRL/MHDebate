"use client";

import { useMemo, useState } from "react";
import { MAX_QUESTION_LENGTH, MIN_QUESTION_LENGTH } from "@/lib/constants";
import { screen } from "@/lib/safety";
import type { PanelRequest } from "@/lib/types";

export interface Example {
  slug: string;
  question: string;
  about: PanelRequest["about"];
}

export interface ProviderInfo {
  id: "anthropic" | "ollama" | null;
  label: string | null;
  model: string | null;
  caveat: string | null;
}

const ABOUT_OPTIONS: Array<{ value: PanelRequest["about"]; label: string }> = [
  { value: "me", label: "Me" },
  { value: "someone-i-care-about", label: "Someone I care about" },
  { value: "a-child-or-teen", label: "A child or teenager" },
];

export function AskForm({
  demo,
  provider,
  examples,
  busy,
  onSubmit,
  onDemo,
}: {
  demo: boolean;
  provider: ProviderInfo | null;
  examples: Example[];
  busy: boolean;
  onSubmit: (request: PanelRequest) => void;
  onDemo: (slug: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [about, setAbout] = useState<PanelRequest["about"]>("me");
  const [includeMeaningVoice, setIncludeMeaningVoice] = useState(false);

  // Screening on keystroke is cheap and pure, and surfacing resources before
  // someone hits submit is the whole point of doing it client-side too.
  const risk = useMemo(() => screen(question), [question]);
  const tooShort = question.trim().length > 0 && question.trim().length < MIN_QUESTION_LENGTH;

  if (demo) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-line bg-raised p-5">
          <h2 className="font-display text-lg">No model is connected</h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            This server has no provider configured, so it can only replay three debates that were
            written out in full. It will not answer your own question — showing you a canned panel
            with your words at the top would be a lie about what you were reading.
          </p>
          <p className="mt-2 max-w-prose text-sm text-muted">
            To ask your own: set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code>, or
            run a model locally and set <code className="font-mono text-xs">MHDEBATE_PROVIDER=ollama</code>.
          </p>
        </div>

        <div className="space-y-3">
          {examples.map((example) => (
            <button
              key={example.slug}
              type="button"
              disabled={busy}
              onClick={() => onDemo(example.slug)}
              className="w-full rounded-2xl border border-line bg-surface p-5 text-left transition-colors hover:border-accent/50 disabled:opacity-50"
            >
              <p className="text-[0.975rem] leading-relaxed">“{example.question}”</p>
              <span className="mt-3 inline-block text-sm text-accent">Watch this one →</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || tooShort || question.trim().length < MIN_QUESTION_LENGTH) return;
        onSubmit({ question: question.trim(), about, includeMeaningVoice });
      }}
    >
      {provider?.model ? (
        <p className="text-xs text-muted">
          Running on <span className="font-mono">{provider.model}</span>
          {provider.label ? ` via ${provider.label}` : null}.
        </p>
      ) : null}

      {provider?.caveat ? (
        <p className="max-w-prose rounded-xl border border-warn/40 bg-warn-soft p-4 text-sm">
          {provider.caveat}
        </p>
      ) : null}

      <div>
        <label htmlFor="question" className="block font-display text-lg">
          What are you trying to understand?
        </label>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Describe it the way you'd describe it to a friend. Concrete detail — when it happens, what
          it feels like, what changed — gets you a far better discussion than a label does.
        </p>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
          rows={6}
          disabled={busy}
          placeholder="I can't start tasks even when I care about them and the deadline is tomorrow…"
          className="mt-3 w-full resize-y rounded-2xl border border-line bg-surface p-4 text-[1.02rem] leading-relaxed outline-none transition-colors placeholder:text-muted/60 focus:border-accent disabled:opacity-60"
        />
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>{tooShort ? "A sentence or two, at least." : "Nothing is stored on our server."}</span>
          <span>
            {question.length}/{MAX_QUESTION_LENGTH}
          </span>
        </div>
      </div>

      {examples.length > 0 && question.length === 0 ? (
        <div>
          <p className="text-sm text-muted">Or start from one of these:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example.slug}
                type="button"
                onClick={() => setQuestion(example.question)}
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-left text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink"
              >
                {example.question.slice(0, 62)}…
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium">Who is this about?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ABOUT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors ${
                about === option.value
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="about"
                value={option.value}
                checked={about === option.value}
                onChange={() => setAbout(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex max-w-prose cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4">
        <input
          type="checkbox"
          checked={includeMeaningVoice}
          onChange={(e) => setIncludeMeaningVoice(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]"
        />
        <span className="text-sm">
          <span className="font-medium">Include a faith and meaning voice.</span>
          <span className="block text-muted">
            Off by default. It asks what this means to you rather than what causes it, and it
            follows your language rather than assuming any belief.
          </span>
        </span>
      </label>

      {risk.level === "crisis" ? (
        <p className="rounded-xl border border-warn/40 bg-warn-soft p-4 text-sm">
          It sounds like you might be in danger right now. The panel won't run on this — there are
          people below who can actually help, and they answer straight away.
        </p>
      ) : risk.level === "concern" ? (
        <p className="rounded-xl border border-warn/40 bg-warn-soft p-4 text-sm">
          This touches on something serious. You'll see support options before the panel starts —
          you can look at those and still carry on.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || question.trim().length < MIN_QUESTION_LENGTH || risk.level === "crisis"}
        className="rounded-full bg-accent px-6 py-3 font-medium text-[rgb(var(--surface))] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "The panel is talking…" : "Convene the panel"}
      </button>
    </form>
  );
}
