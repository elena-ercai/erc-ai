import type { AIProvider, AIProviderName } from "@/services/ai/provider";

import { mockAIProvider } from "./mock";
import { nebiusAIProvider } from "./nebius";

/**
 * Returns the AI provider for the given name.
 *
 * Defaults to "mock" when no provider is configured or the name is
 * unrecognized, so the application always has a working analysis path.
 */
export function getAIProvider(providerName?: string): AIProvider {
  const normalized = providerName?.toLowerCase() as AIProviderName;

  switch (normalized) {
    case "nebius":
      return nebiusAIProvider;

    case "mock":
    default:
      return mockAIProvider;
  }
}
