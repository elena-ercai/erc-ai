// Enforce server-side-only access — this file must never be imported
// from a client component. Next.js webpack recognizes this import and
// throws at build time if a client bundle tries to include it.
// The conditional avoids breaking non-Next.js tooling (e.g. tsx scripts).
if (process.env.NEXT_RUNTIME || process.env.NODE_ENV === 'production') {
  require('server-only');
}
import { Shipment } from '@/lib/models';
import { getCoverageStatus, buildRiskSummary, getEffectiveDateStatus, effectiveDateStatusLabels } from '@/services/risk-engine';
import { regulations } from '@/services/regulations';
import { getSourcesForJurisdiction, filterSourcesByRelevance, unresolvedSource, detectRegulatoryDomains, JurisdictionSource, RegulatoryDomain as SourceDomain } from '@/services/sources';
import {
  RiskReport,
  RiskFinding,
  EvidenceItem,
  RegulatorySource,
  ShipmentSnapshot,
  JurisdictionCoverage,
  CarbonPriceCreditCheck,
  RegulatoryDomain,
  CoverageStatus as SchemaCoverageStatus,
  EffectiveDateStatus as SchemaEffectiveDateStatus,
} from '@/services/risk-engine/schema';
import type { AIAnalysisContext } from '@/services/ai/provider';
import { getAIProvider } from '@/services/ai/providers';

const ISO_CODES: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'GB',
  'European Union': 'EU',
  'Germany': 'DE',
  'Taiwan': 'TW',
  'Singapore': 'SG',
  'Japan': 'JP',
  'Canada': 'CA',
  'Australia': 'AU',
  'South Korea': 'KR',
  'China': 'CN',
  'France': 'FR',
  'Italy': 'IT',
  'Spain': 'ES',
  'Netherlands': 'NL',
  'Vietnam': 'VN',
  'India': 'IN',
  'Brazil': 'BR',
  'Mexico': 'MX',
  'Thailand': 'TH',
  'Malaysia': 'MY',
};

function isoCode(jurisdiction: string): string {
  return ISO_CODES[jurisdiction.trim()] || jurisdiction.substring(0, 2).toUpperCase();
}

function toSchemaCoverage(status: string): SchemaCoverageStatus {
  if (status === 'PRIORITY_COVERAGE') return 'PRIORITY';
  if (status === 'INSUFFICIENT_EVIDENCE') return 'INSUFFICIENT_EVIDENCE';
  return 'LIMITED';
}

function toSchemaDomain(d: SourceDomain): RegulatoryDomain {
  return d as RegulatoryDomain;
}

function buildShipmentSnapshot(shipment: Shipment): ShipmentSnapshot {
  const certs = shipment.certificates
    ? shipment.certificates.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    productName: shipment.productName,
    hsCode: shipment.hsCode || undefined,
    productCategory: shipment.productCategory || undefined,
    keyProductCharacteristics: shipment.productCharacteristics || undefined,
    exportJurisdiction: shipment.exportingCountry,
    destinationJurisdiction: shipment.destinationCountry,
    countryOfOrigin: shipment.countryOfOrigin || undefined,
    plannedImportDate: shipment.plannedImportDate,
    buyerImporter: shipment.buyerImporter,
    endUse: shipment.endUse || undefined,
    supplyChainInformation: shipment.supplyChainInformation || undefined,
    knownCertificates: certs.length ? certs : undefined,
  };
}

const EVIDENCE_STATUS_PRIORITY: Record<EvidenceItem['status'], number> = {
  MISSING: 0,
  RECOMMENDED: 1,
  AVAILABLE: 2,
  NOT_APPLICABLE: 3,
};

function evidenceSlug(label: string): string {
  return 'evidence-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildEvidence(findings: RiskFinding[], knownCertificates: string[]): EvidenceItem[] {
  const map = new Map<string, { label: string; status: EvidenceItem['status']; relatedFindingIds: Set<string> }>();
  const knownLower = knownCertificates.map((c) => c.toLowerCase().trim()).filter(Boolean);

  for (const finding of findings) {
    const missingSet = new Set(finding.missingEvidence.map((e) => e.toLowerCase().trim()));

    for (const ev of finding.requiredEvidence) {
      const key = ev.toLowerCase().trim();
      if (!key) continue;

      let status: EvidenceItem['status'];
      if (missingSet.has(key)) {
        status = 'MISSING';
      } else if (knownLower.some((c) => c.includes(key) || key.includes(c))) {
        status = 'AVAILABLE';
      } else {
        status = 'RECOMMENDED';
      }

      const existing = map.get(key);
      if (!existing) {
        map.set(key, { label: ev, status, relatedFindingIds: new Set([finding.id]) });
      } else {
        existing.relatedFindingIds.add(finding.id);
        if (EVIDENCE_STATUS_PRIORITY[status] < EVIDENCE_STATUS_PRIORITY[existing.status]) {
          existing.status = status;
        }
      }
    }
  }

  return Array.from(map.values()).map(({ label, status, relatedFindingIds }) => ({
    id: evidenceSlug(label),
    label,
    status,
    relatedFindingIds: Array.from(relatedFindingIds),
  }));
}

function validateFindingSources(findings: RiskFinding[], sources: RegulatorySource[]): void {
  const sourceIds = new Set(sources.map((s) => s.id));
  for (const finding of findings) {
    for (const sourceId of finding.sourceIds) {
      if (!sourceIds.has(sourceId)) {
        console.warn('ERC AI warning: Finding references a missing regulatory source.');
        break;
      }
    }
  }
}

function mapSourceType(domains: (SourceDomain | '*')[]): RegulatorySource['sourceType'] {
  if (domains.includes('EXPORT_CONTROL')) return 'EXPORT_CONTROL';
  if (domains.includes('SANCTIONS')) return 'SANCTIONS';
  if (domains.includes('CUSTOMS_TARIFF')) return 'CUSTOMS_TARIFF';
  if (domains.includes('MARKET_ACCESS')) return 'MARKET_ACCESS';
  return 'OFFICIAL_GUIDANCE';
}

function buildSources(
  shipment: Shipment,
  findingCategories: string[],
): { sources: RegulatorySource[]; exportSourceIds: string[]; destinationSourceIds: string[] } {
  const sources: RegulatorySource[] = [];
  const exportSourceIds: string[] = [];
  const destinationSourceIds: string[] = [];

  const productContext = {
    productName: shipment.productName,
    productCategory: shipment.productCategory,
    productCharacteristics: shipment.productCharacteristics,
    hsCode: shipment.hsCode,
  };

  const exportEntries = filterSourcesByRelevance(
    getSourcesForJurisdiction(shipment.exportingCountry, 'export'),
    findingCategories,
    productContext,
  );
  if (exportEntries.length) {
    for (const entry of exportEntries) {
      sources.push({
        id: entry.id,
        jurisdiction: shipment.exportingCountry,
        side: 'EXPORT',
        authority: entry.name,
        title: entry.title,
        sourceType: mapSourceType(entry.regulatoryDomains),
        url: entry.url,
        official: entry.official ?? false,
        regulatoryDomains: entry.regulatoryDomains.filter((d) => d !== '*').map((d) => toSchemaDomain(d as SourceDomain)),
        legalInstrument: entry.legalInstrument,
        citation: entry.citation,
        relevantProvision: entry.relevantProvision,
        directSourceUrl: entry.directSourceUrl,
        sourceGranularity: entry.sourceGranularity,
      });
      exportSourceIds.push(entry.id);
    }
  } else {
    const id = `unresolved-export-${shipment.exportingCountry.toLowerCase().replace(/\s+/g, '-')}`;
    const ph = unresolvedSource(id, shipment.exportingCountry, 'export');
    sources.push({
      id,
      jurisdiction: shipment.exportingCountry,
      side: 'EXPORT',
      authority: ph.name,
      title: ph.title,
      sourceType: 'OTHER',
      url: '',
      official: false,
      regulatoryDomains: [],
      sourceGranularity: 'GENERAL_AUTHORITY',
    });
    exportSourceIds.push(id);
  }

  const destEntries = filterSourcesByRelevance(
    getSourcesForJurisdiction(shipment.destinationCountry, 'destination'),
    findingCategories,
    productContext,
  );
  if (destEntries.length) {
    for (const entry of destEntries) {
      sources.push({
        id: entry.id,
        jurisdiction: entry.jurisdiction || shipment.destinationCountry,
        side: 'DESTINATION',
        authority: entry.name,
        title: entry.title,
        sourceType: mapSourceType(entry.regulatoryDomains),
        url: entry.url,
        official: entry.official ?? false,
        regulatoryDomains: entry.regulatoryDomains.filter((d) => d !== '*').map((d) => toSchemaDomain(d as SourceDomain)),
        legalInstrument: entry.legalInstrument,
        citation: entry.citation,
        relevantProvision: entry.relevantProvision,
        directSourceUrl: entry.directSourceUrl,
        sourceGranularity: entry.sourceGranularity,
      });
      destinationSourceIds.push(entry.id);
    }
  } else {
    const id = `unresolved-destination-${shipment.destinationCountry.toLowerCase().replace(/\s+/g, '-')}`;
    const ph = unresolvedSource(id, shipment.destinationCountry, 'destination');
    sources.push({
      id,
      jurisdiction: shipment.destinationCountry,
      side: 'DESTINATION',
      authority: ph.name,
      title: ph.title,
      sourceType: 'OTHER',
      url: '',
      official: false,
      regulatoryDomains: [],
      sourceGranularity: 'GENERAL_AUTHORITY',
    });
    destinationSourceIds.push(id);
  }

  return { sources, exportSourceIds, destinationSourceIds };
}

/** Maps AI provider name to the schema analysisMeta.provider value. */
function providerToMetaName(name: string): 'MOCK' | 'NEBIUS' {
  if (name === 'nebius') return 'NEBIUS';
  return 'MOCK';
}

/** Domain labels for finding categories used by the mock provider. */
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

/**
 * Maps a JurisdictionSource from the source registry into the
 * AIAnalysisContext.regulatorySources entry format, using the
 * registry's stable id as the sourceId.
 */
type ContextRegulatorySource = NonNullable<AIAnalysisContext["regulatorySources"]>[number];

function toContextSource(
  entry: JurisdictionSource,
): ContextRegulatorySource {
  return {
    sourceId: entry.id,
    jurisdiction: entry.jurisdiction,
    side: entry.side === "export" ? "EXPORT" : "DESTINATION",
    authority: entry.name,
    title: entry.title,
    legalInstrument: entry.legalInstrument,
    citation: entry.citation,
    relevantProvision: entry.relevantProvision,
    directSourceUrl: entry.directSourceUrl,
    sourceGranularity: entry.sourceGranularity,
    regulatoryDomains: entry.regulatoryDomains
      .filter((d) => d !== "*")
      .map((d) => String(d)),
    official: entry.official,
  };
}

/**
 * Builds the complete AIAnalysisContext for a shipment using the same
 * logic the production pipeline uses. This is the single shared
 * context-building function — both analyzeShipment() and dry-run tests
 * call it so there is no duplicate or divergent test-only context.
 *
 * Populates:
 *   - shipment transaction facts (no company/order location)
 *   - regulatorySources from the source registry, filtered by detected
 *     regulatory domains relevant to this shipment
 *   - deterministicContext with coverage status and effective-date
 *     status for applicable regulations
 */
export function buildAIAnalysisContext(shipment: Shipment): AIAnalysisContext {
  const exportCoverage = getCoverageStatus(shipment.exportingCountry);
  const destinationCoverage = getCoverageStatus(shipment.destinationCountry);

  const certs = shipment.certificates
    ? shipment.certificates.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const productContext = {
    productName: shipment.productName,
    productCategory: shipment.productCategory,
    productCharacteristics: shipment.productCharacteristics,
    hsCode: shipment.hsCode,
  };

  // Gather regulatory sources from the source registry for both sides.
  // Use detected regulatory domains (from HS code + characteristics) to
  // filter to only relevant sources. No finding categories yet — sources
  // are retrieved from shipment facts alone so the system is not gated
  // on findings being generated first.
  const exportEntries = filterSourcesByRelevance(
    getSourcesForJurisdiction(shipment.exportingCountry, "export"),
    [],
    productContext,
  );
  const destEntries = filterSourcesByRelevance(
    getSourcesForJurisdiction(shipment.destinationCountry, "destination"),
    [],
    productContext,
  );

  const regulatorySources: ContextRegulatorySource[] = [];
  for (const entry of exportEntries) {
    regulatorySources.push(toContextSource(entry));
  }
  for (const entry of destEntries) {
    regulatorySources.push(toContextSource(entry));
  }

  // Build deterministic context: coverage + effective-date status for
  // regulations applicable to the destination jurisdiction.
  const deterministicContext: AIAnalysisContext["deterministicContext"] = [
    { coverageStatus: exportCoverage },
    { coverageStatus: destinationCoverage },
  ];

  const dest = shipment.destinationCountry.toLowerCase().trim();
  const applicableRegs = regulations.filter((r) => {
    if (dest.includes("united kingdom") || dest === "uk") {
      return r.id === "uk-cbam";
    }
    if (dest.includes("germany") || dest.includes("european union") || dest === "eu") {
      return r.id === "eu-cbam";
    }
    return false;
  });

  for (const reg of applicableRegs) {
    const status = getEffectiveDateStatus(
      shipment.plannedImportDate,
      reg.effectiveFrom,
      reg.effectiveTo,
    );
    const statusLabel = effectiveDateStatusLabels[status];
    deterministicContext.push({
      regulationName: reg.title,
      effectiveDateStatus: statusLabel,
      thresholdResult: "Threshold review required",
      coverageStatus: destinationCoverage,
    });
  }

  return {
    shipment: {
      productName: shipment.productName,
      hsCode: shipment.hsCode || undefined,
      productCategory: shipment.productCategory || undefined,
      keyProductCharacteristics: shipment.productCharacteristics || undefined,
      exportJurisdiction: shipment.exportingCountry,
      destinationJurisdiction: shipment.destinationCountry,
      plannedImportDate: shipment.plannedImportDate,
      buyerImporter: shipment.buyerImporter,
      endUse: shipment.endUse || undefined,
      supplyChainInformation: shipment.supplyChainInformation || undefined,
      knownCertificates: certs,
    },
    regulatoryContext: [
      {
        jurisdiction: shipment.exportingCountry,
        sourceIds: [],
      },
      {
        jurisdiction: shipment.destinationCountry,
        sourceIds: [],
      },
    ],
    regulatorySources,
    deterministicContext,
  };
}

/**
 * Mock risk engine for Day 2.
 *
 * Returns a RiskReport conforming to /services/risk-engine/schema.ts (v1.0).
 * The flow is:
 *
 *   Shipment → buildAIAnalysisContext() → AIProvider.analyze()
 *   → RiskFinding[] → Evidence, Summary, Coverage → RiskReport
 *
 * The AI provider returns findings only. Summary, coverage, evidence
 * deduplication, source validation, and carbon-price credit are all
 * calculated by this deterministic application layer.
 */
export async function analyzeShipment(shipment: Shipment): Promise<RiskReport> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const exportCoverage = getCoverageStatus(shipment.exportingCountry);
  const destinationCoverage = getCoverageStatus(shipment.destinationCountry);

  const context = buildAIAnalysisContext(shipment);
  const certs = context.shipment.knownCertificates ?? [];

  // Get provider from env or default to mock
  const provider = getAIProvider(process.env.AI_PROVIDER);
  const result = await provider.analyze(context);
  const findings = result.findings;

  // Extract side-channel metadata from mock provider
  const sideChannel = findings as unknown as { _nextActions?: string[]; _reliefText?: string };
  const nextActions = sideChannel._nextActions ?? [];
  const reliefText = sideChannel._reliefText ?? 'No relief pathway identified for this shipment.';
  delete (findings as unknown as { _nextActions?: string[] })._nextActions;
  delete (findings as unknown as { _reliefText?: string })._reliefText;

  // Build filtered sources using finding categories, then assign source IDs
  const findingCategories = findings.map((f) => DOMAIN_TO_CATEGORY[f.domain] || 'Other');
  const { sources: finalSources } = buildSources(shipment, findingCategories);

  // Assign source IDs to findings by jurisdiction + side + regulatory domain.
  // A source is only bound to a finding when it matches on all three axes.
  // CROSS_BORDER findings receive no sources via this path.
  for (const finding of findings) {
    finding.sourceIds = finalSources
      .filter((src) =>
        src.jurisdiction === finding.jurisdiction &&
        src.side === finding.side &&
        src.regulatoryDomains.includes(finding.domain),
      )
      .map((src) => src.id);
  }

  const knownCertificates = certs;
  const evidenceChecklist = buildEvidence(findings, knownCertificates);

  // Build carbon price credit from findings
  const hasCbam = findings.some((f) => f.domain === 'CBAM');
  let carbonPriceCredit: CarbonPriceCreditCheck;
  if (!hasCbam) {
    carbonPriceCredit = { status: 'NOT_RELEVANT' };
  } else {
    const hasCarbonEvidence = findings.some((f) =>
      f.requiredEvidence.some((e) => e.toLowerCase().includes('carbon')),
    );
    if (reliefText.includes('No relief') || reliefText.includes('No certificate')) {
      carbonPriceCredit = { status: 'NO_CARBON_PRICE_PAID', reason: reliefText };
    } else if (hasCarbonEvidence) {
      carbonPriceCredit = {
        status: 'EVIDENCE_INCOMPLETE',
        reason: reliefText,
        missingEvidence: ['Carbon-pricing evidence', 'Verified embedded-emissions data'],
        recommendedActions: ['Gather evidence of any eligible carbon price paid in the export jurisdiction.'],
      };
    } else {
      carbonPriceCredit = { status: 'REVIEW_REQUIRED', reason: reliefText };
    }
  }

  validateFindingSources(findings, finalSources);

  const coverage: JurisdictionCoverage = {
    exportSide: {
      jurisdiction: isoCode(shipment.exportingCountry),
      status: toSchemaCoverage(exportCoverage),
    },
    destinationSide: {
      jurisdiction: isoCode(shipment.destinationCountry),
      status: toSchemaCoverage(destinationCoverage),
    },
  };

  const requiresHumanReview = findings.some((f) => f.requiresHumanReview) ||
    findings.some((f) => f.riskLevel === 'HIGH') ||
    exportCoverage === 'INSUFFICIENT_EVIDENCE' ||
    destinationCoverage === 'INSUFFICIENT_EVIDENCE';

  const summary = buildRiskSummary(findings, requiresHumanReview);

  const reportId = `ERC${new Date().getFullYear()}${Math.floor(100000 + Math.random() * 900000)}`;

  return {
    schemaVersion: '1.0',
    reportId,
    generatedAt: new Date().toISOString(),
    shipment: buildShipmentSnapshot(shipment),
    coverage,
    summary,
    findings,
    evidenceChecklist,
    carbonPriceCredit,
    sources: finalSources,
    nextActions,
    requiresHumanReview,
    analysisMeta: {
      provider: providerToMetaName(result.provider),
      mockData: result.provider === 'mock',
      regulatoryRetrieval: 'MOCK',
    },
  };
}
