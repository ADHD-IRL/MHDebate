import type { Metadata } from "next";
import { SupportPanel } from "@/components/SupportPanel";
import { CRISIS_LINES, TOPIC_SUPPORT } from "@/lib/safety";

export const metadata: Metadata = {
  title: "Get support — MHDebate",
  description: "Crisis lines and specialist helplines. Real people, answering now.",
};

const SPECIALIST = [
  { key: "abuse" as const, title: "Abuse and domestic violence" },
  { key: "eating" as const, title: "Eating and food" },
  { key: "substances" as const, title: "Alcohol and drugs" },
];

export default function SupportPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="font-display text-4xl tracking-tight">If you need a person</h1>
        <p className="max-w-prose text-lg leading-relaxed text-muted">
          You do not have to be in an emergency to use any of these. Most of the people who call
          crisis lines are not in immediate danger — they are having a bad night and want someone to
          talk to, which is exactly what the lines are for.
        </p>
      </header>

      <SupportPanel lines={CRISIS_LINES} />

      <section className="space-y-6">
        <h2 className="font-display text-2xl">Specific things</h2>
        {SPECIALIST.map((item) => (
          <SupportPanel key={item.key} lines={TOPIC_SUPPORT[item.key]} title={item.title} />
        ))}
      </section>

      <section className="max-w-prose space-y-3 text-sm text-muted">
        <h2 className="font-display text-xl text-ink">Numbers change</h2>
        <p>
          These were correct when this page was written, and services do move. If one of them
          doesn't connect,{" "}
          <a
            href="https://findahelpline.com"
            className="text-accent underline underline-offset-2"
            rel="noreferrer noopener"
            target="_blank"
          >
            findahelpline.com
          </a>{" "}
          keeps a verified list for more than 130 countries and is the most reliable single place to
          look.
        </p>
      </section>
    </div>
  );
}
