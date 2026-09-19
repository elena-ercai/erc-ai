export type RiskLevel = 'LOW' | 'REVIEW' | 'HIGH' | 'INSUFFICIENT_EVIDENCE';

export type CoverageStatus =
  | 'PRIORITY_COVERAGE'
  | 'LIMITED_COVERAGE'
  | 'INSUFFICIENT_EVIDENCE';

export type EffectiveDateStatus =
  | 'NOT_YET_EFFECTIVE'
  | 'ACTIVE'
  | 'TRANSITIONAL'
  | 'EXPIRED_OR_SUPERSEDED';

export interface Shipment {
  productName: string;
  hsCode: string;
  productCategory: string;
  productCharacteristics: string;
  exportingCountry: string;
  destinationCountry: string;
  buyerImporter: string;
  plannedImportDate: string;
  endUse: string;
  supplyChainInformation: string;
  certificates: string;
}

export interface RiskCheck {
  id: string;
  shipment: Shipment;
  status: string;
  createdAt: string;
}

export type SourceSide = 'export' | 'destination';

export interface OfficialSource {
  id: string;
  name: string;
  title: string;
  url: string;
  side?: SourceSide;
  jurisdiction?: string;
  official?: boolean;
  lastVerified?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  regulatoryDomains?: string[];
  legalInstrument?: string;
  citation?: string;
  relevantProvision?: string;
  directSourceUrl?: string;
  sourceGranularity?: "LEGAL_PROVISION" | "SPECIFIC_GUIDANCE" | "GENERAL_AUTHORITY";
}

export type RegulatorySourceType =
  | 'LAW'
  | 'EXPORT_CONTROL'
  | 'SANCTIONS'
  | 'CUSTOMS_TARIFF'
  | 'MARKET_ACCESS'
  | 'PRODUCT_REGULATION'
  | 'OFFICIAL_GUIDANCE'
  | 'OTHER';

export interface RegulatorySource {
  jurisdiction: string;
  authority: string;
  sourceType: RegulatorySourceType;
  title: string;
  url: string;
  priority: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  lastVerified?: string;
  active: boolean;
}

export interface RiskFinding {
  id: string;
  category: string;
  riskLevel: RiskLevel;
  title: string;
  summary: string;
  reason: string;
  requiredEvidence: string[];
  recommendedAction: string;
  sourceIds: string[];
  effectiveFrom?: string;
  shipmentDate?: string;
  effectiveDateStatus?: EffectiveDateStatus;
  regulationId?: string;
  jurisdiction?: string;
  hsCode?: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  status: 'Missing' | 'Provided' | 'Recommended' | 'Not Applicable';
  relatedFindingIds?: string[];
  schemaStatus?: 'AVAILABLE' | 'MISSING' | 'RECOMMENDED' | 'NOT_APPLICABLE';
}

export interface RiskReport {
  id: string;
  generatedAt: string;
  shipment: Shipment;
  overallRisk: RiskLevel;
  assessmentTitle: string;
  assessmentSummary: string;
  findings: RiskFinding[];
  evidence: EvidenceItem[];
  nextActions: string[];
  sources: OfficialSource[];
  regulatoryRiskLabel?: string;
  regulatoryRiskStatus?: EffectiveDateStatus | null;
  reliefText?: string;
  exportCoverage?: CoverageStatus;
  destinationCoverage?: CoverageStatus;
  summaryLow?: number;
  summaryReview?: number;
  summaryHigh?: number;
}

export interface Regulation {
  id: string;
  title: string;
  jurisdiction: string;
  category: string;
  summary: string;
  status: 'Upcoming' | 'In Force';
  effectiveDate: string;
  effectiveFrom: string;
  effectiveTo?: string;
  effectiveDateStatus?: EffectiveDateStatus;
  lastChecked: string;
  officialSourceName: string;
  officialSourceUrl: string;
}
