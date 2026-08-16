import { anthropicProvider } from "./anthropic";
import { ollamaProvider } from "./ollama";
import {
  ProviderSetupError,
  RefusalError,
  type LlmProvider,
  type ProseCall,
  type StructuredCall,
} from "./types";

export { ProviderSetupError, RefusalError };
export type { LlmProvider, ProseCall, StructuredCall };

/**
 * Selection is explicit first, then inferred, and never guesses in a way that
 * costs money: an unset MHDEBATE_PROVIDER with no Anthropic key and no Ollama
 * model configured lands in demo mode rather than quietly reaching for
 * something.
 */
export function activeProvider(): LlmProvider | null {
  const explicit = process.env.MHDEBATE_PROVIDER?.trim().toLowerCase();

  if (explicit === "ollama") return ollamaProvider;
  if (explicit === "anthropic") return anthropicProvider.available() ? anthropicProvider : null;
  if (explicit === "demo") return null;

  if (anthropicProvider.available()) return anthropicProvider;
  if (process.env.OLLAMA_MODEL?.trim() || process.env.OLLAMA_HOST?.trim()) return ollamaProvider;
  return null;
}

export interface ProviderInfo {
  id: LlmProvider["id"] | null;
  label: string | null;
  model: string | null;
  caveat: string | null;
}

export function providerInfo(): ProviderInfo {
  const provider = activeProvider();
  if (!provider) return { id: null, label: null, model: null, caveat: null };
  return {
    id: provider.id,
    label: provider.label,
    model: provider.model(),
    caveat: provider.caveat(),
  };
}

function required(): LlmProvider {
  const provider = activeProvider();
  if (!provider) throw new Error("No model provider is configured.");
  return provider;
}

export const streamProse = (call: ProseCall): Promise<string> => required().streamProse(call);

export const structured = <T,>(call: StructuredCall): Promise<T> => required().structured<T>(call);

export const maxParallel = (): number => activeProvider()?.maxParallel() ?? 4;

export const preflight = (): Promise<void> => required().preflight?.() ?? Promise.resolve();
