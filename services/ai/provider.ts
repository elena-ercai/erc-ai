import type { RiskFinding } from "@/services/risk-engine/schema";

export type AIProviderName = "mock" | "nebius";

export interface AIAnalysisContext {
  shipment: {
    productName: string;
    productDescription?: string;
    hsCode?: string;
    productCategory?: string;
    keyProductCharacteristics?: string;

    exportJurisdiction: string;
    destinationJurisdiction: string;

    plannedImportDate: string;

    buyerImporter: string;
    endUse?: string;

    supplyChainInformation?: string;
    knownCertificates?: string[];
    uploadedDocuments?: string[];
  };

  regulatoryContext: {
    jurisdiction: string;
    sourceIds: string[];
    evidenceText?: string;
  }[];

  /**
   * Full structured source metadata for the request builder.
   * Populated by the deterministic layer before calling the provider so
   * buildAIRequest() can include legal instruments and provisions.
   */
  regulatorySources?: {
    sourceId: string;
    jurisdiction: string;
    side: "EXPORT" | "DESTINATION";
    authority: string;
    title: string;
    legalInstrument?: string;
    citation?: string;
    relevantProvision?: string;
    directSourceUrl?: string;
    sourceGranularity?: "LEGAL_PROVISION" | "SPECIFIC_GUIDANCE" | "GENERAL_AUTHORITY";
    regulatoryDomains: string[];
    official?: boolean;
    evidenceText?: string;
  }[];

  deterministicContext?: {
    regulationName?: string;
    effectiveDateStatus?: string;
    thresholdResult?: string;
    coverageStatus?: string;
  }[];
}

export interface AIAnalysisResult {
  findings: RiskFinding[];

  provider: AIProviderName;

  model?: string;
}

export interface AIProvider {
  name: AIProviderName;

  analyze(context: AIAnalysisContext): Promise<AIAnalysisResult>;
}

export class AIProviderError extends Error {
  provider: AIProviderName;

  constructor(provider: AIProviderName, message: string) {
    super(message);
    this.name = "AIProviderError";
    this.provider = provider;
  }
}
