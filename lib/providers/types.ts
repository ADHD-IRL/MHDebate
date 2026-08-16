/**
 * The seam between the panel and whatever model is running it.
 *
 * The engine only ever sees these two calls: stream some prose, or return JSON
 * matching a schema. Everything provider-specific — auth, refusal handling,
 * context windows, how structured output is coaxed out of a local model —
 * lives behind this interface.
 */

export type Effort = "low" | "medium" | "high";

export interface BaseCall {
  system: string;
  user: string;
  /** A hint, not a setting. Providers map it to whatever they actually have. */
  effort: Effort;
  maxTokens: number;
  signal?: AbortSignal;
}

export type ProseCall = BaseCall & { onDelta: (text: string) => void };
export type StructuredCall = BaseCall & { schema: Record<string, unknown> };

export class RefusalError extends Error {
  constructor(readonly category: string | null) {
    super("The model declined to answer this one.");
    this.name = "RefusalError";
  }
}

/** Thrown when the provider is reachable but misconfigured in a fixable way. */
export class ProviderSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderSetupError";
  }
}

export interface LlmProvider {
  readonly id: "anthropic" | "ollama";
  /** Shown to the reader, e.g. "Ollama". */
  readonly label: string;
  /** The model actually in use. */
  model(): string;
  /** Configured well enough to attempt a run. */
  available(): boolean;
  /**
   * How many requests to have in flight at once. The first-takes round is
   * parallel by design, but a single local GPU does not benefit from six
   * simultaneous generations the way a hosted API does.
   */
  maxParallel(): number;
  /**
   * Something the reader should know about this provider's output before they
   * read it. Rendered in the UI, not just logged.
   */
  caveat(): string | null;
  /** Optional check run once per debate, before any generation. */
  preflight?(): Promise<void>;
  streamProse(call: ProseCall): Promise<string>;
  structured<T>(call: StructuredCall): Promise<T>;
}
