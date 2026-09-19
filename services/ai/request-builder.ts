// Enforce server-side-only access — this file must never be imported
// from a client component. Next.js webpack recognizes this import and
// throws at build time if a client bundle tries to include it.
// The conditional avoids breaking non-Next.js tooling (e.g. tsx scripts).
if (process.env.NEXT_RUNTIME || process.env.NODE_ENV === 'production') {
  require('server-only');
}

import { ERC_AI_SYSTEM_PROMPT } from "@/services/ai/prompts";

import type { AIAnalysisContext } from "@/services/ai/provider";

export interface PreparedAIRequest {
  systemPrompt: string;

  userPayload: {
    shipment: AIAnalysisContext["shipment"];

    regulatorySources: {
      sourceId: string;
      jurisdiction: string;
      side: string;
      authority: string;
      title: string;

      legalInstrument?: string;
      citation?: string;
      relevantProvision?: string;
      directSourceUrl?: string;
      sourceGranularity?: string;

      regulatoryDomains: string[];

      official?: boolean;

      evidenceText?: string;
    }[];

    deterministicContext: {
      regulationName?: string;
      effectiveDateStatus?: string;
      thresholdResult?: string;
      coverageStatus?: string;
    }[];
  };

  allowedSourceIds: string[];
}

/**
 * Assembles the complete provider-neutral AI request payload from the
 * current analysis context.
 *
 * Includes:
 *   - ERC_AI_SYSTEM_PROMPT (provider-independent)
 *   - shipment transaction facts only (no company/order location)
 *   - structured regulatory source evidence with legal metadata
 *   - deterministic rule results the model must treat as authoritative
 *   - allowed source IDs the model may cite
 *
 * No secrets, credentials, or provider-specific syntax are included.
 */
export function buildAIRequest(
  context: AIAnalysisContext,
): PreparedAIRequest {
  const regulatorySources = (context.regulatorySources ?? []).map((s) => {
    const domains = s.regulatoryDomains;

    const evidenceParts: string[] = [];
    if (s.legalInstrument) evidenceParts.push(s.legalInstrument);
    if (s.citation) evidenceParts.push(s.citation);
    if (s.relevantProvision) evidenceParts.push(s.relevantProvision);

    const evidenceText =
      s.evidenceText ??
      (evidenceParts.length > 0
        ? evidenceParts.join("\n")
        : s.sourceGranularity === "GENERAL_AUTHORITY"
          ? "General authority source — specific provision text not yet retrieved."
          : undefined);

    return {
      sourceId: s.sourceId,
      jurisdiction: s.jurisdiction,
      side: s.side,
      authority: s.authority,
      title: s.title,
      legalInstrument: s.legalInstrument,
      citation: s.citation,
      relevantProvision: s.relevantProvision,
      directSourceUrl: s.directSourceUrl,
      sourceGranularity: s.sourceGranularity,
      regulatoryDomains: domains,
      official: s.official,
      evidenceText,
    };
  });

  const allowedSourceIds = regulatorySources.map((s) => s.sourceId);

  return {
    systemPrompt: ERC_AI_SYSTEM_PROMPT,
    userPayload: {
      shipment: context.shipment,
      regulatorySources,
      deterministicContext: context.deterministicContext ?? [],
    },
    allowedSourceIds,
  };
}

/**
 * Builds a provider-neutral chat message array from a prepared request.
 *
 * The system message carries the ERC AI system prompt.
 * The user message is a JSON string containing shipment facts,
 * regulatory source evidence, deterministic context, and allowed
 * source IDs.
 *
 * No provider-specific endpoint syntax, API keys, or credentials.
 */
export function buildModelMessages(
  request: PreparedAIRequest,
): { role: "system" | "user"; content: string }[] {
  return [
    {
      role: "system",
      content: request.systemPrompt,
    },
    {
      role: "user",
      content: JSON.stringify({
        shipment: request.userPayload.shipment,
        regulatorySources: request.userPayload.regulatorySources,
        deterministicContext: request.userPayload.deterministicContext,
        allowedSourceIds: request.allowedSourceIds,
      }),
    },
  ];
}
