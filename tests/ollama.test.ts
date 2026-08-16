import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ThinkingStripper,
  extractJson,
  ollamaProvider,
  resetPreflightForTests,
  stripThinking,
} from "@/lib/providers/ollama";
import { ProviderSetupError } from "@/lib/providers/types";

describe("ThinkingStripper", () => {
  const feed = (chunks: string[]): string => {
    const stripper = new ThinkingStripper();
    return chunks.map((c) => stripper.push(c)).join("") + stripper.flush();
  };

  it("passes ordinary text through untouched", () => {
    expect(feed(["Hello ", "there."])).toBe("Hello there.");
  });

  it("removes a reasoning block", () => {
    expect(feed(["<think>hmm, let me consider</think>The answer."])).toBe("The answer.");
  });

  it("removes a block split across chunk boundaries", () => {
    // The realistic case: tokens arrive a few characters at a time, so the
    // tags themselves get cut in half.
    expect(feed(["<thi", "nk>secret rea", "soning</thi", "nk>Visible."])).toBe("Visible.");
  });

  it("handles text before, between, and after blocks", () => {
    expect(feed(["A <think>x</think>B<think>y</think>C"])).toBe("A BC");
  });

  it("accepts the other tag spellings models use", () => {
    expect(feed(["<thinking>x</thinking>ok"])).toBe("ok");
    expect(feed(["<reasoning>x</reasoning>ok"])).toBe("ok");
  });

  it("drops an unterminated block rather than leaking it", () => {
    expect(feed(["good.<think>never closed"])).toBe("good.");
  });

  it("does not swallow a lone angle bracket", () => {
    expect(feed(["5 < 6 and 7 > 6"])).toBe("5 < 6 and 7 > 6");
  });

  it("emits progressively rather than buffering to the end", () => {
    const stripper = new ThinkingStripper();
    const first = stripper.push("This is a reasonably long sentence that should flow. ");
    expect(first.length).toBeGreaterThan(0);
  });
});

describe("stripThinking", () => {
  it("trims what is left", () => {
    expect(stripThinking("<think>a</think>\n\n  Answer.  ")).toBe("Answer.");
  });
});

describe("extractJson", () => {
  it("returns clean JSON unchanged", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it("digs JSON out of surrounding prose", () => {
    expect(extractJson('Sure! Here you go:\n{"a":1}\nHope that helps.')).toBe('{"a":1}');
  });

  it("strips a fenced code block", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("balances nested objects rather than stopping at the first brace", () => {
    const json = '{"a":{"b":{"c":1}},"d":2}';
    expect(extractJson(`noise ${json} more noise`)).toBe(json);
  });

  it("is not fooled by braces inside strings", () => {
    const json = '{"a":"} not the end {","b":1}';
    expect(extractJson(json)).toBe(json);
  });

  it("is not fooled by an escaped quote before a brace", () => {
    const json = '{"a":"say \\"}\\" here","b":1}';
    expect(extractJson(json)).toBe(json);
  });

  it("returns null when there is no object at all", () => {
    expect(extractJson("I'm afraid I can't do that.")).toBeNull();
  });
});

// ------------------------------------------------------------ live-ish calls

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

/** Reads the JSON body a mocked fetch was called with. */
function requestBody(mock: unknown, index = 0): Record<string, unknown> {
  const { calls } = (mock as { mock: { calls: Array<[unknown, RequestInit]> } }).mock;
  return JSON.parse(String(calls[index][1].body)) as Record<string, unknown>;
}

function ndjsonResponse(lines: object[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

beforeEach(() => {
  resetPreflightForTests();
  process.env.OLLAMA_MODEL = "llama3.1:8b";
  delete process.env.OLLAMA_THINK;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe("ollamaProvider.streamProse", () => {
  it("streams visible text and hides the reasoning", async () => {
    globalThis.fetch = vi.fn(async () =>
      ndjsonResponse([
        { message: { content: "<think>plan" }, done: false },
        { message: { content: "ning</think>The " }, done: false },
        { message: { content: "answer." }, done: false },
        { done: true },
      ]),
    ) as unknown as typeof fetch;

    const seen: string[] = [];
    const text = await ollamaProvider.streamProse({
      system: "s",
      user: "u",
      effort: "low",
      maxTokens: 100,
      onDelta: (chunk) => seen.push(chunk),
    });

    expect(text).toBe("The answer.");
    expect(seen.join("")).toBe("The answer.");
    expect(seen.join("")).not.toContain("planning");
  });

  it("raises the context window, or the synthesis prompt gets truncated", async () => {
    const fetchMock = vi.fn(async () => ndjsonResponse([{ message: { content: "x" }, done: true }]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await ollamaProvider.streamProse({
      system: "s",
      user: "u",
      effort: "low",
      maxTokens: 100,
      onDelta: () => {},
    });

    const body = requestBody(fetchMock) as { options: { num_ctx: number }; keep_alive: string };
    expect(body.options.num_ctx).toBeGreaterThanOrEqual(8192);
    expect(body.keep_alive).toBeTruthy();
    // `think` breaks models that don't support it, so it must be absent unless asked for.
    expect(body).not.toHaveProperty("think");
  });

  it("explains a missing model instead of leaking a 404", async () => {
    globalThis.fetch = vi.fn(async () => new Response("model not found", { status: 404 })) as
      unknown as typeof fetch;

    await expect(
      ollamaProvider.streamProse({
        system: "s",
        user: "u",
        effort: "low",
        maxTokens: 10,
        onDelta: () => {},
      }),
    ).rejects.toThrow(/ollama pull llama3\.1:8b/);
  });

  it("explains a connection refusal instead of leaking a fetch error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(
      ollamaProvider.streamProse({
        system: "s",
        user: "u",
        effort: "low",
        maxTokens: 10,
        onDelta: () => {},
      }),
    ).rejects.toThrow(/ollama serve/);
  });
});

describe("ollamaProvider.structured", () => {
  const schema = { type: "object", properties: { a: { type: "number" } } };

  it("sends the schema and parses the reply", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ message: { content: '{"a":1}' } }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await ollamaProvider.structured<{ a: number }>({
      system: "s",
      user: "u",
      effort: "low",
      maxTokens: 100,
      schema,
    });

    expect(result).toEqual({ a: 1 });
    const body = requestBody(fetchMock) as { format: unknown; options: { temperature: number } };
    expect(body.format).toEqual(schema);
    expect(body.options.temperature).toBeLessThan(0.5);
  });

  it("recovers JSON wrapped in chatter", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ message: { content: '<think>ok</think>Here:\n```json\n{"a":2}\n```' } }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const result = await ollamaProvider.structured<{ a: number }>({
      system: "s",
      user: "u",
      effort: "low",
      maxTokens: 100,
      schema,
    });
    expect(result).toEqual({ a: 2 });
  });

  it("falls back to plain JSON mode when the schema is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unsupported format", { status: 400 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: { content: '{"a":3}' } }), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await ollamaProvider.structured<{ a: number }>({
      system: "s",
      user: "u",
      effort: "low",
      maxTokens: 100,
      schema,
    });

    expect(result).toEqual({ a: 3 });
    const second = requestBody(fetchMock, 1) as {
      format: string;
      messages: Array<{ content: string }>;
    };
    expect(second.format).toBe("json");
    // The schema has to travel in the prompt once it's no longer enforced.
    expect(second.messages[1].content).toContain('"type":"object"');
  });

  it("says which model failed rather than throwing a parse error", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: { content: "no json here" } }), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(
      ollamaProvider.structured({ system: "s", user: "u", effort: "low", maxTokens: 10, schema }),
    ).rejects.toThrow(/llama3\.1:8b did not return usable JSON/);
  });
});

describe("ollamaProvider.preflight", () => {
  it("passes when the model is installed", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ models: [{ name: "llama3.1:8b" }] }), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(ollamaProvider.preflight?.()).resolves.toBeUndefined();
  });

  it("matches a tagged install when the config omits the tag", async () => {
    process.env.OLLAMA_MODEL = "llama3.1";
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ models: [{ name: "llama3.1:8b" }] }), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(ollamaProvider.preflight?.()).resolves.toBeUndefined();
  });

  it("names the pull command and what is installed when the model is missing", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ models: [{ name: "mistral:7b" }] }), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(ollamaProvider.preflight?.()).rejects.toThrow(
      /ollama pull llama3\.1:8b.*mistral:7b/s,
    );
  });

  it("reports a setup problem, not a crash, when Ollama is down", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(ollamaProvider.preflight?.()).rejects.toBeInstanceOf(ProviderSetupError);
  });
});

describe("provider selection", () => {
  async function select(env: Record<string, string | undefined>) {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    const { activeProvider } = await import("@/lib/providers");
    return activeProvider()?.id ?? null;
  }

  const blank = {
    MHDEBATE_PROVIDER: undefined,
    ANTHROPIC_API_KEY: undefined,
    OLLAMA_MODEL: undefined,
    OLLAMA_HOST: undefined,
  };

  it("falls back to demo when nothing is configured", async () => {
    expect(await select(blank)).toBeNull();
  });

  it("prefers an explicit choice over an available key", async () => {
    expect(await select({ ...blank, ANTHROPIC_API_KEY: "sk-x", MHDEBATE_PROVIDER: "ollama" })).toBe(
      "ollama",
    );
  });

  it("uses Anthropic when a key is present and nothing was chosen", async () => {
    expect(await select({ ...blank, ANTHROPIC_API_KEY: "sk-x" })).toBe("anthropic");
  });

  it("infers Ollama from its own settings", async () => {
    expect(await select({ ...blank, OLLAMA_MODEL: "llama3.1:8b" })).toBe("ollama");
  });

  it("never silently reaches for a paid API that isn't configured", async () => {
    expect(await select({ ...blank, MHDEBATE_PROVIDER: "anthropic" })).toBeNull();
  });
});
