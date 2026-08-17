import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/beta/messages/messages";

export const DEFAULT_MODEL = "claude-opus-5";

/**
 * Server-side fallback: a policy decline is re-served by another model inside
 * the same call, routed by refusal category. Mental-health text sits close
 * enough to the safety classifiers that a reader would otherwise hit an
 * unexplained dead end for asking an ordinary question.
 */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function model(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let cached: Anthropic | null = null;

export function client(): Anthropic {
  if (!cached) cached = new Anthropic();
  return cached;
}

export class RefusalError extends Error {
  constructor(readonly category: string | null) {
    super("The model declined to answer this one.");
    this.name = "RefusalError";
  }
}

type Effort = "low" | "medium" | "high";

interface BaseCall {
  system: string;
  user: string;
  effort: Effort;
  maxTokens: number;
  signal?: AbortSignal;
}

function baseParams(call: BaseCall, useFallbacks: boolean): MessageCreateParamsBase {
  return {
    model: model(),
    max_tokens: call.maxTokens,
    system: call.system,
    messages: [{ role: "user", content: call.user }],
    ...(useFallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
  };
}

/** An older or restricted deployment may reject the fallback beta; fall back
 *  to plain requests rather than failing the whole panel over it. */
function isFallbackRejection(err: unknown): boolean {
  if (!(err instanceof Anthropic.BadRequestError)) return false;
  const message = String(err.message ?? "").toLowerCase();
  return message.includes("fallback") || message.includes("beta");
}

function textOf(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
    .trim();
}

/** Stream a prose answer, pushing deltas as they arrive. */
export async function streamProse(
  call: BaseCall & { onDelta: (text: string) => void },
): Promise<string> {
  const run = async (useFallbacks: boolean): Promise<string> => {
    const stream = client().beta.messages.stream(
      { ...baseParams(call, useFallbacks), output_config: { effort: call.effort } },
      { signal: call.signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        call.onDelta(event.delta.text);
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new RefusalError(final.stop_details?.category ?? null);
    }
    return textOf(final.content);
  };

  try {
    return await run(true);
  } catch (err) {
    if (isFallbackRejection(err)) return run(false);
    throw err;
  }
}

/** Ask for JSON matching a schema, and return it parsed. */
export async function structured<T>(
  call: BaseCall & { schema: Record<string, unknown> },
): Promise<T> {
  const run = async (useFallbacks: boolean): Promise<T> => {
    // Streaming keeps a large structured answer under the SDK's HTTP timeout.
    const stream = client().beta.messages.stream(
      {
        ...baseParams(call, useFallbacks),
        output_config: {
          effort: call.effort,
          format: { type: "json_schema", schema: call.schema },
        },
      },
      { signal: call.signal },
    );

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new RefusalError(final.stop_details?.category ?? null);
    }
    if (final.stop_reason === "max_tokens") {
      throw new Error("The reply was cut off before the JSON was complete.");
    }

    return JSON.parse(textOf(final.content)) as T;
  };

  try {
    return await run(true);
  } catch (err) {
    if (isFallbackRejection(err)) return run(false);
    throw err;
  }
}
