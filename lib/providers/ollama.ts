import {
  ProviderSetupError,
  type LlmProvider,
  type ProseCall,
  type StructuredCall,
} from "./types";

/**
 * Ollama, for running the panel entirely on your own machine.
 *
 * Two things make this more than a base-URL swap. Local models frequently emit
 * their reasoning inline in <think> tags, which would otherwise stream straight
 * into the reader's face; and the default context window is small enough that
 * the synthesis prompt — which carries every take and every push-back — gets
 * silently truncated unless num_ctx is raised.
 */

const DEFAULT_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1:8b";
const DEFAULT_NUM_CTX = 8192;

function host(): string {
  const raw = process.env.OLLAMA_HOST?.trim() || DEFAULT_HOST;
  const withScheme = /^https?:\/\//.test(raw) ? raw : `http://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

function modelName(): string {
  return process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL;
}

function numCtx(): number {
  const value = Number(process.env.OLLAMA_NUM_CTX ?? DEFAULT_NUM_CTX);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_NUM_CTX;
}

function keepAlive(): string {
  // Holding the model in memory between the dozen calls of one debate is the
  // difference between a slow run and an unusable one.
  return process.env.OLLAMA_KEEP_ALIVE?.trim() || "10m";
}

/** Some models need `think` set explicitly; most error if it's sent at all. */
function thinkFlag(): boolean | undefined {
  const raw = process.env.OLLAMA_THINK?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

// ------------------------------------------------------------ thinking tags

const OPEN_TAG = /<(think|thinking|reasoning)>/i;
const CLOSE_TAG = /<\/(think|thinking|reasoning)>/i;
/** Longest closing tag, so we know how much tail to hold back mid-stream. */
const TAIL_GUARD = "</reasoning>".length - 1;

/**
 * Strips inline reasoning from a token stream without buffering the whole
 * response. A tag can straddle two chunks, so a short tail is held back until
 * the next chunk proves it isn't the start of one.
 */
export class ThinkingStripper {
  private buffer = "";
  private inside = false;

  push(chunk: string): string {
    this.buffer += chunk;
    let out = "";

    for (;;) {
      if (this.inside) {
        const close = CLOSE_TAG.exec(this.buffer);
        if (!close) {
          // Keep only enough to recognise a split closing tag.
          if (this.buffer.length > TAIL_GUARD) {
            this.buffer = this.buffer.slice(-TAIL_GUARD);
          }
          return out;
        }
        this.buffer = this.buffer.slice(close.index + close[0].length);
        this.inside = false;
        continue;
      }

      const open = OPEN_TAG.exec(this.buffer);
      if (open) {
        out += this.buffer.slice(0, open.index);
        this.buffer = this.buffer.slice(open.index + open[0].length);
        this.inside = true;
        continue;
      }

      // No tag in sight: emit everything except a possible partial one.
      const safe = Math.max(0, this.buffer.length - TAIL_GUARD);
      const lastOpen = this.buffer.lastIndexOf("<");
      const cut = lastOpen === -1 ? this.buffer.length : Math.min(safe, lastOpen);
      out += this.buffer.slice(0, cut);
      this.buffer = this.buffer.slice(cut);
      return out;
    }
  }

  flush(): string {
    if (this.inside) {
      this.buffer = "";
      return "";
    }
    const rest = this.buffer;
    this.buffer = "";
    return rest;
  }
}

/** One-shot version, for non-streamed responses. */
export function stripThinking(text: string): string {
  const stripper = new ThinkingStripper();
  return (stripper.push(text) + stripper.flush()).trim();
}

// ------------------------------------------------------------ JSON recovery

/**
 * Local models honour a JSON schema most of the time and wrap it in prose the
 * rest of the time. Pulling the outermost balanced object out is cheaper than
 * a retry and works for the common failure.
 */
export function extractJson(text: string): string | null {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i += 1) {
    const char = cleaned[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

// ------------------------------------------------------------------- client

interface ChatBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream: boolean;
  keep_alive: string;
  options: Record<string, unknown>;
  format?: unknown;
  think?: boolean;
}

function body(call: { system: string; user: string; maxTokens: number }, extra: Partial<ChatBody>): ChatBody {
  const think = thinkFlag();
  return {
    model: modelName(),
    messages: [
      { role: "system", content: call.system },
      { role: "user", content: call.user },
    ],
    stream: false,
    keep_alive: keepAlive(),
    options: { num_ctx: numCtx(), num_predict: call.maxTokens },
    ...(think === undefined ? {} : { think }),
    ...extra,
  };
}

async function chat(payload: ChatBody, signal?: AbortSignal): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${host()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ProviderSetupError(
      `Could not reach Ollama at ${host()}. Is it running? Start it with \`ollama serve\`.`,
    );
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    if (response.status === 404) {
      throw new ProviderSetupError(
        `Ollama does not have "${modelName()}". Pull it with \`ollama pull ${modelName()}\`.`,
      );
    }
    throw new Error(`Ollama returned ${response.status}: ${detail}`);
  }

  return response;
}

/** Ollama streams newline-delimited JSON, one object per token batch. */
async function* ndjson(
  response: Response,
): AsyncGenerator<{ message?: { content?: string }; done?: boolean; error?: string }> {
  if (!response.body) throw new Error("Ollama sent an empty response body.");

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line);
    }
  }

  const tail = buffer.trim();
  if (tail) yield JSON.parse(tail);
}

async function readWhole(response: Response): Promise<string> {
  const payload = (await response.json()) as {
    message?: { content?: string };
    error?: string;
  };
  if (payload.error) throw new Error(`Ollama: ${payload.error}`);
  return payload.message?.content ?? "";
}

// ------------------------------------------------------------------ provider

let preflighted = false;

export const ollamaProvider: LlmProvider = {
  id: "ollama",
  label: "Ollama",

  model: modelName,

  // Ollama needs no credential, so "configured" means someone asked for it.
  available: () => true,

  maxParallel: () => {
    const value = Number(process.env.OLLAMA_NUM_PARALLEL ?? 2);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 2;
  },

  caveat: () =>
    "This panel is running on a local model. Local models follow instructions less reliably than the hosted ones this was written for, so expect weaker voices, more repetition, and occasional slips past the no-diagnosis rule. Read it as a rough draft of a discussion, not as the finished thing.",

  async preflight() {
    if (preflighted) return;

    let response: Response;
    try {
      response = await fetch(`${host()}/api/tags`);
    } catch {
      throw new ProviderSetupError(
        `Could not reach Ollama at ${host()}. Start it with \`ollama serve\`, or set OLLAMA_HOST.`,
      );
    }
    if (!response.ok) {
      throw new ProviderSetupError(`Ollama at ${host()} answered ${response.status}.`);
    }

    const { models = [] } = (await response.json()) as { models?: Array<{ name: string }> };
    const installed = models.map((m) => m.name);
    const wanted = modelName();

    // `llama3.1:8b` and `llama3.1` should both match a pulled `llama3.1:8b`.
    const present = installed.some((name) => name === wanted || name.split(":")[0] === wanted);
    if (!present) {
      throw new ProviderSetupError(
        `Ollama is running but "${wanted}" is not pulled. Run \`ollama pull ${wanted}\`.` +
          (installed.length ? ` Installed: ${installed.join(", ")}.` : " No models are installed."),
      );
    }

    preflighted = true;
  },

  async streamProse(call: ProseCall): Promise<string> {
    const response = await chat(
      body(call, {
        stream: true,
        options: {
          num_ctx: numCtx(),
          num_predict: call.maxTokens,
          temperature: Number(process.env.OLLAMA_TEMPERATURE ?? 0.8),
        },
      }),
      call.signal,
    );

    const stripper = new ThinkingStripper();
    let full = "";

    for await (const chunk of ndjson(response)) {
      if (chunk.error) throw new Error(`Ollama: ${chunk.error}`);
      const piece = chunk.message?.content;
      if (!piece) continue;
      const visible = stripper.push(piece);
      if (visible) {
        full += visible;
        call.onDelta(visible);
      }
    }

    const tail = stripper.flush();
    if (tail) {
      full += tail;
      call.onDelta(tail);
    }

    return full.trim();
  },

  async structured<T>(call: StructuredCall): Promise<T> {
    const options = {
      num_ctx: numCtx(),
      num_predict: call.maxTokens,
      // Schema-constrained output wants determinism, not personality.
      temperature: 0.1,
    };

    const attempt = async (payload: ChatBody): Promise<string> =>
      stripThinking(await readWhole(await chat(payload, call.signal)));

    let raw: string;
    try {
      // Ollama constrains generation to the schema when `format` is an object.
      raw = await attempt(body(call, { format: call.schema, options }));
    } catch (err) {
      if (err instanceof ProviderSetupError) throw err;
      // Older builds, and some model/schema combinations, reject a full schema.
      // Fall back to plain JSON mode with the schema stated in the prompt.
      raw = await attempt(
        body(
          {
            ...call,
            user: `${call.user}\n\nReply with JSON only, matching this schema exactly:\n${JSON.stringify(call.schema)}`,
          },
          { format: "json", options },
        ),
      );
    }

    const candidate = extractJson(raw) ?? raw;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      throw new Error(
        `${modelName()} did not return usable JSON for this step. A larger model usually fixes this.`,
      );
    }
  },
};

/** Test seam: preflight caches per process, and tests need it to run again. */
export function resetPreflightForTests(): void {
  preflighted = false;
}
