// SERVER-SIDE ONLY — this provider must never be imported into client-side
// React components. Future API keys must be stored server-side and never
// exposed via NEXT_PUBLIC_* variables.
if (process.env.NEXT_RUNTIME || process.env.NODE_ENV === 'production') {
  require('server-only');
}

import type {
  AIProvider,
  AIAnalysisContext,
  AIAnalysisResult,
} from "@/services/ai/provider";

import { AIProviderError } from "@/services/ai/provider";

import {
  buildAIRequest,
  buildModelMessages,
} from "@/services/ai/request-builder";

/**
 * Nebius AI provider stub.
 *
 * This provider is prepared but not connected. It assembles the full
 * provider-neutral request payload (system prompt + shipment facts +
 * regulatory source evidence + deterministic context + allowed source
 * IDs) and builds the chat message array, but does NOT make any
 * network call, import an SDK, or read an API key.
 *
 * When the Nebius endpoint is wired in a future step, the prepared
 * request and messages will be sent via fetch — this stub defines
 * the architecture so the application can switch from "mock" to
 * "nebius" without changing the rest of the system.
 *
 * SERVER-SIDE ONLY — this provider must never be imported into client-side
 * React components. Future API keys must be stored server-side and never
 * exposed via NEXT_PUBLIC_* variables.
 */
export const nebiusAIProvider: AIProvider = {
  name: "nebius",

  async analyze(
    context: AIAnalysisContext,
  ): Promise<AIAnalysisResult> {
    const preparedRequest = buildAIRequest(context);
    const messages = buildModelMessages(preparedRequest);

    // The prepared request and messages are fully assembled and ready
    // for the future Nebius API call. We void them to acknowledge the
    // compiler that these are used, then throw — no network call is made.
    void messages;
    void preparedRequest;

    throw new AIProviderError(
      "nebius",
      "Nebius AI provider is prepared but not connected yet.",
    );
  },
};
