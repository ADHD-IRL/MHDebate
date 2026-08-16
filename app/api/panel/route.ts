import { NextRequest } from "next/server";
import {
  activeProvider,
  preflight,
  providerInfo,
  ProviderSetupError,
  RefusalError,
} from "@/lib/providers";
import { DEMOS, demoBySlug, type DemoDebate } from "@/lib/demo";
import { MAX_QUESTION_LENGTH, MIN_QUESTION_LENGTH } from "@/lib/constants";
import { runPanel } from "@/lib/engine";
import { needsAcknowledgement, screen } from "@/lib/safety";
import type { PanelEvent, PanelRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tells the client whether it's talking to a live panel or the worked examples. */
export async function GET() {
  const provider = providerInfo();
  return Response.json({
    demo: provider.id === null,
    provider,
    examples: DEMOS.map((d) => ({ slug: d.slug, question: d.question, about: d.about })),
  });
}

// ------------------------------------------------------------ rate limiting

const RATE_WINDOW_MS = 60 * 60 * 1000;
const buckets = new Map<string, number[]>();

function rateLimit(key: string): boolean {
  const cap = Number(process.env.MHDEBATE_RATE_LIMIT ?? 12);
  if (!Number.isFinite(cap) || cap <= 0) return true;

  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= cap) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);

  // Keep the map from growing without bound on a long-lived server.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) buckets.delete(k);
    }
  }
  return true;
}

function clientKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

// ------------------------------------------------------------------- stream

function sseStream(
  produce: (emit: (event: PanelEvent) => void, signal: AbortSignal) => Promise<void>,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: PanelEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        await produce(emit, signal);
      } catch (err) {
        emit({ type: "error", message: describeError(err) });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed by the client disconnecting */
          }
        }
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function describeError(err: unknown): string {
  if (err instanceof RefusalError) {
    return "The model declined to take this one on. That is sometimes over-cautious rather than a judgement about your question — rephrasing in more everyday terms often gets through.";
  }
  // Setup problems are the operator's to fix and are safe to show verbatim:
  // they name a command, not an internal.
  if (err instanceof ProviderSetupError) return err.message;

  const message = err instanceof Error ? err.message : String(err);
  if (/abort/i.test(message)) return "The panel was stopped.";
  if (/rate.?limit|429/i.test(message)) {
    return "The model is rate limited right now. Wait a minute and try again.";
  }
  if (/api[_ ]?key|authentication|401/i.test(message)) {
    return "The server's API key is missing or rejected. Check ANTHROPIC_API_KEY.";
  }
  // Never surface raw provider errors to a reader who came here about their
  // own mental health; they are noise at best and alarming at worst.
  console.error("[panel]", err);
  return "Something broke on our side before the panel finished. Nothing you did caused it.";
}

// ------------------------------------------------------------------ handler

export async function POST(req: NextRequest) {
  let payload: Partial<PanelRequest> & { acknowledgedSupport?: boolean; demoSlug?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const provider = activeProvider();

  if (!provider) {
    const example = payload.demoSlug ? demoBySlug(payload.demoSlug) : undefined;
    if (!example) {
      return Response.json(
        {
          error:
            "No model provider is configured, so this server can only replay the worked examples. Pick one of those, or set ANTHROPIC_API_KEY (or MHDEBATE_PROVIDER=ollama) to ask your own question.",
        },
        { status: 400 },
      );
    }
    return sseStream((emit, signal) => replayDemo(example, emit, signal), req.signal);
  }

  const question = (payload.question ?? "").trim();
  if (question.length < MIN_QUESTION_LENGTH) {
    return Response.json(
      { error: "Give the panel a bit more to work with — a sentence or two at least." },
      { status: 400 },
    );
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `Keep it under ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // The client screens too, for instant feedback. This is the copy that counts.
  const risk = screen(question);
  if (risk.level === "crisis") {
    return Response.json(
      { error: "halted", risk },
      { status: 200, headers: { "X-Panel-Halted": "crisis" } },
    );
  }
  if (needsAcknowledgement(risk) && !payload.acknowledgedSupport) {
    return Response.json({ error: "acknowledgement-required", risk }, { status: 200 });
  }

  if (!rateLimit(clientKey(req))) {
    return Response.json(
      { error: "That's a lot of panels in one hour. Give it a little while." },
      { status: 429 },
    );
  }

  const request: PanelRequest = {
    question,
    about:
      payload.about === "someone-i-care-about" || payload.about === "a-child-or-teen"
        ? payload.about
        : "me",
    includeMeaningVoice: payload.includeMeaningVoice === true,
  };

  return sseStream(async (emit, signal) => {
    // Catches "Ollama isn't running" or "that model isn't pulled" before the
    // reader watches four voices fail one at a time.
    await preflight();

    const caveat = provider.caveat();
    if (caveat) emit({ type: "notice", message: caveat });

    await runPanel(request, emit, signal);
  }, req.signal);
}

// --------------------------------------------------------------- demo replay

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Replays a written example at roughly the pace a live panel runs at, so the
 * demo shows the real shape of the thing — including the wait — rather than
 * dumping a finished page.
 */
async function replayDemo(
  demo: DemoDebate,
  emit: (event: PanelEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  emit({
    type: "notice",
    message:
      "This is a written example, replayed. The server has no API key, so no model is running.",
  });

  emit({ type: "stage", stage: "convening" });
  await sleep(900, signal);
  emit({ type: "panel", panel: demo.panel });

  emit({ type: "stage", stage: "first-takes" });
  for (const take of demo.takes) emit({ type: "take-start", voiceId: take.voiceId });

  // Interleave the takes so the demo shows the round genuinely running in
  // parallel, which is the property the real first pass depends on.
  const cursors = demo.takes.map((t) => ({ voiceId: t.voiceId, words: t.text.split(" "), at: 0 }));
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const cursor of cursors) {
      if (cursor.at >= cursor.words.length) continue;
      const step = 3 + Math.floor(Math.random() * 4);
      const chunk = cursor.words.slice(cursor.at, cursor.at + step).join(" ");
      cursor.at += step;
      emit({
        type: "take-delta",
        voiceId: cursor.voiceId,
        text: (cursor.at === step ? "" : " ") + chunk,
      });
      if (cursor.at >= cursor.words.length) emit({ type: "take-end", voiceId: cursor.voiceId });
      remaining = true;
    }
    await sleep(38, signal);
  }

  emit({ type: "stage", stage: "cross-talk" });
  await sleep(700, signal);
  for (const challenge of demo.challenges) {
    emit({ type: "challenge-start", voiceId: challenge.voiceId, targetId: challenge.targetId });
    const words = challenge.text.split(" ");
    for (let i = 0; i < words.length; i += 4) {
      emit({
        type: "challenge-delta",
        voiceId: challenge.voiceId,
        targetId: challenge.targetId,
        text: (i === 0 ? "" : " ") + words.slice(i, i + 4).join(" "),
      });
      await sleep(34, signal);
    }
    emit({ type: "challenge-end", voiceId: challenge.voiceId, targetId: challenge.targetId });
    await sleep(220, signal);
  }

  emit({ type: "stage", stage: "summing-up" });
  await sleep(1100, signal);
  emit({ type: "synthesis", synthesis: demo.synthesis });
  emit({ type: "stage", stage: "done" });
  emit({ type: "done" });
}
