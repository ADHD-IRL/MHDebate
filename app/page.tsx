import Link from "next/link";
import { Panel } from "@/components/Panel";

function Hero() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="max-w-3xl font-display text-4xl leading-[1.12] tracking-tight sm:text-5xl">
          A panel that argues, so you can think.
        </h1>
        <p className="mt-5 max-w-prose text-lg leading-relaxed text-muted">
          Describe something you're trying to make sense of. Four to six different perspectives
          answer independently, then read each other and push back. You get their honest
          disagreement — not a tidy verdict, and not a diagnosis.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "They can't see each other",
            body: "The first round runs in parallel, in separate contexts. No voice is anchored by what another said.",
          },
          {
            title: "Disagreement survives",
            body: "Where they don't agree is shown as prominently as where they do, with what would settle it.",
          },
          {
            title: "Nothing is stored",
            body: "Your question is sent to the model and then gone. No account, no database, no history.",
          },
        ].map((item) => (
          <li key={item.title} className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="font-medium">{item.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
          </li>
        ))}
      </ul>

      <p className="max-w-prose text-sm text-muted">
        This is a thinking tool, not care.{" "}
        <Link href="/how-it-works" className="text-accent underline underline-offset-2">
          What it can and can't do
        </Link>
        {" · "}
        <Link href="/support" className="text-accent underline underline-offset-2">
          If you need help now
        </Link>
      </p>
    </section>
  );
}

export default function HomePage() {
  return <Panel intro={<Hero />} />;
}
