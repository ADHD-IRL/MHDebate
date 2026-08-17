import { NextRequest } from "next/server";
import { hasApiKey, RefusalError } from "@/lib/anthropic";
import { clinicalSynthesis } from "@/lib/clinical";
import { MAX_QUESTION_LENGTH, MIN_QUESTION_LENGTH } from "@/lib/constants";
import { demoBySlug } from "@/lib/demo";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { screen } from "@/lib/safety";
import { isVoiceId } from "@/lib/voices";
import type { Challenge, PanelRequest, Take } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Turns a finished debate into notes for a clinician. Runs on request rather
 * than automatically: it is a second model call, and most readers will never
 * want it.
 *
 * The debate arrives in the request body because the server keeps nothing
 * between calls. That is the same trade the rest of the app makes — no history
 * to leak, at the cost of posting the transcript back to generate this.
 */
export async function POST(req: NextRequest) {
  let payload: {
    request?: Partial<PanelRequest>;
    panel?: { framing?: string };
    takes?: Take[];
    challenges?: Challenge[];
    synthesis?: unknown;
    demoSlug?: string;
  };

  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  // Without a key the app only ever showed written examples, so the clinical
  // pass has to come from the same place rather than inventing one.
  if (!hasApiKey()) {
    const example = payload.demoSlug ? demoBySlug(payload.demoSlug) : undefined;
    if (!example?.clinical) {
      return Response.json(
        {
          error:
            "No API key is configured, so notes can only be shown for the worked examples.",
        },
        { status: 400 },
      );
    }
    return Response.json({ clinical: example.clinical });
  }

  const question = (payload.request?.question ?? "").trim();
  if (question.length < MIN_QUESTION_LENGTH || question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: "That doesn't look like a debate we produced." }, { status: 400 });
  }

  // The screen ran before the debate; re-running it here closes the gap where
  // someone posts straight to this endpoint with different text.
  if (screen(question).level === "crisis") {
    return Response.json({ error: "halted" }, { status: 200 });
  }

  const takes = (Array.isArray(payload.takes) ? payload.takes : []).filter(
    (t): t is Take => isVoiceId(t?.voiceId) && typeof t?.text === "string" && t.text.length > 0,
  );
  if (takes.length < 2) {
    return Response.json({ error: "That debate is too short to summarise." }, { status: 400 });
  }

  const challenges = (Array.isArray(payload.challenges) ? payload.challenges : []).filter(
    (c): c is Challenge =>
      isVoiceId(c?.voiceId) && isVoiceId(c?.targetId) && typeof c?.text === "string",
  );

  if (!rateLimit(clientKey(req))) {
    return Response.json(
      { error: "That's a lot of requests in one hour. Give it a little while." },
      { status: 429 },
    );
  }

  const request: PanelRequest = {
    question,
    about:
      payload.request?.about === "someone-i-care-about" ||
      payload.request?.about === "a-child-or-teen"
        ? payload.request.about
        : "me",
    includeMeaningVoice: payload.request?.includeMeaningVoice === true,
  };

  try {
    const clinical = await clinicalSynthesis(
      request,
      { framing: payload.panel?.framing ?? "", seated: [], notSeated: [] },
      takes,
      challenges,
      // The consumer summary is optional context; the notes are built from the
      // transcript either way.
      (payload.synthesis as never) ?? null,
      req.signal,
    );
    return Response.json({ clinical });
  } catch (err) {
    if (err instanceof RefusalError) {
      return Response.json(
        { error: "The model declined to summarise this one. The debate itself is still yours." },
        { status: 200 },
      );
    }
    console.error("[clinical]", err);
    return Response.json(
      { error: "Could not put the notes together. Nothing you did caused it." },
      { status: 500 },
    );
  }
}
