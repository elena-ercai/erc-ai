export type RiskLevel =
  | "LOW"
  | "REVIEW"
  | "HIGH";

export type OverallAssessment =
  | "LOW_RISK"
  | "REVIEW_RECOMMENDED"
  | "HIGH_RISK"
  | "INSUFFICIENT_EVIDENCE";

export type CoverageStatus =
  | "PRIORITY"
  | "LIMITED"
  | "INSUFFICIENT_EVIDENCE";

export type EffectiveDateStatus =
  | "NOT_YET_EFFECTIVE"
  | "ACTIVE"
  | "TRANSITIONAL"
  | "EXPIRED_OR_SUPERSEDED";

export type RegulatoryDomain =
  | "PRODUCT_CLASSIFICATION"
  | "CUSTOMS_TARIFF"
  | "EXPORT_CONTROL"
  | "SANCTIONS"
  | "BUYER_ENTITY_RISK"
  | "MARKET_ACCESS"
  | "PRODUCT_SAFETY"
  | "FOOD_CONTACT"
  | "ORIGIN_MARKING"
  | "TRADE_REMEDY"
  | "CBAM"
  | "ESG_SUSTAINABILITY"
  | "FORCED_LABOUR"
  | "DOCUMENTATION"
  | "OTHER";

export interface ShipmentSnapshot {
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
}

export interface JurisdictionCoverage {
  exportSide: {
    jurisdiction: string;
    status: CoverageStatus;
  };

  destinationSide: {
    jurisdiction: string;
    status: CoverageStatus;
  };
}

export interface EffectiveDateCheck {
  regulationName: string;

  effectiveFrom?: string;
  effectiveTo?: string;

  plannedImportDate: string;

  status: EffectiveDateStatus;

  explanation: string;
}

export interface RegulatorySource {
  id: string;

  jurisdiction: string;

  side:
    | "EXPORT"
    | "DESTINATION";

  authority: string;

  title: string;

  sourceType:
    | "LAW"
    | "CUSTOMS_TARIFF"
    | "EXPORT_CONTROL"
    | "SANCTIONS"
    | "MARKET_ACCESS"
    | "PRODUCT_REGULATION"
    | "OFFICIAL_GUIDANCE"
    | "OTHER";

  url: string;

  official: boolean;

  effectiveFrom?: string;
  effectiveTo?: string;

  lastVerified?: string;

  regulatoryDomains: RegulatoryDomain[];

  legalInstrument?: string;
  citation?: string;
  relevantProvision?: string;
  directSourceUrl?: string;
  sourceGranularity?: "LEGAL_PROVISION" | "SPECIFIC_GUIDANCE" | "GENERAL_AUTHORITY";
}

export interface RiskFinding {
  id: string;

  domain: RegulatoryDomain;

  title: string;

  riskLevel: RiskLevel;

  jurisdiction: string;

  side:
    | "EXPORT"
    | "DESTINATION"
    | "CROSS_BORDER";

  regulationName?: string;

  reason: string;

  effectiveDateCheck?: EffectiveDateCheck;

  requiredEvidence: string[];

  missingEvidence: string[];

  recommendedActions: string[];

  sourceIds: string[];

  confidence: number;

  requiresHumanReview: boolean;
}

export interface EvidenceItem {
  id: string;

  label: string;

  status:
    | "AVAILABLE"
    | "MISSING"
    | "RECOMMENDED"
    | "NOT_APPLICABLE";

  relatedFindingIds: string[];
}

export interface RiskSummary {
  low: number;
  review: number;
  high: number;

  overallAssessment: OverallAssessment;
}

export type CarbonPriceCreditStatus =
  | "NOT_RELEVANT"
  | "NO_CARBON_PRICE_PAID"
  | "POTENTIALLY_ELIGIBLE"
  | "EVIDENCE_INCOMPLETE"
  | "REVIEW_REQUIRED";

export interface CarbonPriceCreditCheck {
  status: CarbonPriceCreditStatus;

  jurisdiction?: string;

  schemeName?: string;

  reason?: string;

  missingEvidence?: string[];

  recommendedActions?: string[];

  sourceIds?: string[];
}

export interface RiskReport {
  schemaVersion: "1.0";

  reportId: string;

  generatedAt: string;

  shipment: ShipmentSnapshot;

  coverage: JurisdictionCoverage;

  summary: RiskSummary;

  findings: RiskFinding[];

  evidenceChecklist: EvidenceItem[];

  carbonPriceCredit?: CarbonPriceCreditCheck;

  sources: RegulatorySource[];

  nextActions: string[];

  requiresHumanReview: boolean;

  analysisMeta: {
    provider:
      | "MOCK"
      | "NEBIUS";

    model?: string;

    mockData: boolean;

    regulatoryRetrieval:
      | "MOCK"
      | "LIVE"
      | "NONE";

    confidence?: number;
  };
}
