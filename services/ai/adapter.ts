import {
  RiskReport as SchemaRiskReport,
  RiskFinding as SchemaRiskFinding,
  EvidenceItem as SchemaEvidenceItem,
  RegulatorySource as SchemaRegulatorySource,
  RegulatoryDomain,
  RiskLevel as SchemaRiskLevel,
} from '@/services/risk-engine/schema';
import {
  RiskReport as LegacyRiskReport,
  RiskFinding as LegacyRiskFinding,
  EvidenceItem as LegacyEvidenceItem,
  OfficialSource,
  Shipment,
  RiskLevel as LegacyRiskLevel,
  CoverageStatus as LegacyCoverageStatus,
  EffectiveDateStatus,
} from '@/lib/models';

/** Maps new-schema RiskLevel to the legacy 4-value union (adds INSUFFICIENT_EVIDENCE). */
function mapRiskLevel(level: SchemaRiskLevel): LegacyRiskLevel {
  return level as LegacyRiskLevel;
}

/** Maps new-schema CoverageStatus to legacy CoverageStatus naming. */
function mapCoverageStatus(status: 'PRIORITY' | 'LIMITED' | 'INSUFFICIENT_EVIDENCE'): LegacyCoverageStatus {
  if (status === 'PRIORITY') return 'PRIORITY_COVERAGE';
  if (status === 'LIMITED') return 'LIMITED_COVERAGE';
  return 'INSUFFICIENT_EVIDENCE';
}

/** Maps a schema RegulatoryDomain to the legacy finding "category" string. */
const DOMAIN_TO_CATEGORY: Record<RegulatoryDomain, string> = {
  PRODUCT_CLASSIFICATION: 'Customs & Classification',
  CUSTOMS_TARIFF: 'Tariff & Trade Remedy',
  EXPORT_CONTROL: 'Export Control',
  SANCTIONS: 'Sanctions & Restricted Parties',
  BUYER_ENTITY_RISK: 'Sanctions & Restricted Parties',
  MARKET_ACCESS: 'Market Access',
  PRODUCT_SAFETY: 'Product Safety',
  FOOD_CONTACT: 'Food Contact',
  ORIGIN_MARKING: 'Market Access',
  TRADE_REMEDY: 'Tariff & Trade Remedy',
  CBAM: 'Sustainability',
  ESG_SUSTAINABILITY: 'Sustainability',
  FORCED_LABOUR: 'Product Safety',
  DOCUMENTATION: 'Documentation',
  OTHER: 'Other',
};

function mapFinding(f: SchemaRiskFinding): LegacyRiskFinding {
  return {
    id: f.id,
    category: DOMAIN_TO_CATEGORY[f.domain] || 'Other',
    riskLevel: mapRiskLevel(f.riskLevel),
    title: f.title,
    summary: f.reason,
    reason: f.reason,
    requiredEvidence: f.requiredEvidence,
    recommendedAction: f.recommendedActions.join(' '),
    sourceIds: f.sourceIds,
    effectiveFrom: f.effectiveDateCheck?.effectiveFrom,
    shipmentDate: f.effectiveDateCheck?.plannedImportDate,
    effectiveDateStatus: f.effectiveDateCheck?.status,
    regulationId: f.regulationName,
    jurisdiction: f.jurisdiction,
    hsCode: undefined,
  };
}

function mapEvidence(e: SchemaEvidenceItem): LegacyEvidenceItem {
  const statusMap: Record<SchemaEvidenceItem['status'], LegacyEvidenceItem['status']> = {
    AVAILABLE: 'Provided',
    MISSING: 'Missing',
    RECOMMENDED: 'Recommended',
    NOT_APPLICABLE: 'Not Applicable',
  };
  return {
    id: e.id,
    title: e.label,
    status: statusMap[e.status],
    relatedFindingIds: e.relatedFindingIds,
    schemaStatus: e.status,
  };
}

function mapSource(s: SchemaRegulatorySource): OfficialSource {
  return {
    id: s.id,
    name: s.authority,
    title: s.title,
    url: s.url,
    side: s.side === 'EXPORT' ? 'export' : 'destination',
    jurisdiction: s.jurisdiction,
    official: s.official,
    lastVerified: s.lastVerified,
    effectiveFrom: s.effectiveFrom,
    effectiveTo: s.effectiveTo,
    regulatoryDomains: s.regulatoryDomains,
    legalInstrument: s.legalInstrument,
    citation: s.citation,
    relevantProvision: s.relevantProvision,
    directSourceUrl: s.directSourceUrl,
    sourceGranularity: s.sourceGranularity,
  };
}

function mapShipment(snap: SchemaRiskReport['shipment']): Shipment {
  return {
    productName: snap.productName,
    hsCode: snap.hsCode || '',
    productCategory: snap.productCategory || '',
    productCharacteristics: snap.keyProductCharacteristics || '',
    exportingCountry: snap.exportJurisdiction,
    destinationCountry: snap.destinationJurisdiction,
    buyerImporter: snap.buyerImporter,
    plannedImportDate: snap.plannedImportDate,
    endUse: snap.endUse || '',
    supplyChainInformation: snap.supplyChainInformation || '',
    certificates: (snap.knownCertificates || []).join(', '),
  };
}

/**
 * Converts a new-schema RiskReport (services/risk-engine/schema.ts) into the
 * legacy RiskReport shape (lib/models.ts) that the existing UI components
 * consume. This is a temporary bridge — the UI will be migrated to the new
 * schema in a later step.
 */
export function adaptToLegacyReport(report: SchemaRiskReport): LegacyRiskReport {
  const overallAssessmentMap: Record<string, LegacyRiskLevel> = {
    HIGH_RISK: 'HIGH',
    REVIEW_RECOMMENDED: 'REVIEW',
    LOW_RISK: 'LOW',
    INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  };
  const overallRisk = overallAssessmentMap[report.summary.overallAssessment] || 'INSUFFICIENT_EVIDENCE';

  const assessmentTitleMap: Record<string, string> = {
    HIGH_RISK: 'High Risk',
    REVIEW_RECOMMENDED: 'Review Recommended',
    LOW_RISK: 'Low Risk',
    INSUFFICIENT_EVIDENCE: 'Insufficient Evidence — Human Review Recommended',
  };
  const assessmentTitle = assessmentTitleMap[report.summary.overallAssessment] || 'Insufficient Evidence — Human Review Recommended';

  const summaryLow = report.summary.low;
  const summaryReview = report.summary.review;
  const summaryHigh = report.summary.high;

  if (summaryLow == null || summaryReview == null || summaryHigh == null) {
    console.warn(
      'ERC AI warning: Risk summary counts are missing from the adapted RiskReport.',
    );
  }

  const assessmentSummary = overallRisk === 'INSUFFICIENT_EVIDENCE'
    ? 'ERC AI could not find enough reliable regulatory evidence to support a conclusion. Do not rely on automated results — engage a qualified compliance adviser.'
    : overallRisk === 'REVIEW'
      ? 'Some applicable regulations and compliance requirements need further attention. Additional evidence may be required.'
      : 'The shipment appears low risk based on the available information. Continue standard compliance preparation.';

  const regulatoryRiskLabel = report.findings
    .filter((f) => f.regulationName)
    .map((f) => f.regulationName!)
    [0] || 'No specific regulation identified';

  const regulatoryRiskStatus = report.findings
    .filter((f) => f.effectiveDateCheck)
    .map((f) => f.effectiveDateCheck!.status)
    [0] || null;

  const reliefText = report.carbonPriceCredit && report.carbonPriceCredit.status !== 'NOT_RELEVANT'
    ? report.carbonPriceCredit.reason || 'Possible carbon-price relief subject to supporting evidence.'
    : 'No relief pathway identified for this shipment.';

  return {
    id: report.reportId,
    generatedAt: report.generatedAt,
    shipment: mapShipment(report.shipment),
    overallRisk,
    assessmentTitle,
    assessmentSummary,
    findings: report.findings.map(mapFinding),
    evidence: report.evidenceChecklist.map(mapEvidence),
    nextActions: report.nextActions,
    sources: report.sources.map(mapSource),
    regulatoryRiskLabel,
    regulatoryRiskStatus,
    reliefText,
    exportCoverage: mapCoverageStatus(report.coverage.exportSide.status),
    destinationCoverage: mapCoverageStatus(report.coverage.destinationSide.status),
    summaryLow,
    summaryReview,
    summaryHigh,
  };
}
