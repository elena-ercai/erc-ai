import type {
  AIProvider,
  AIAnalysisContext,
  AIAnalysisResult,
} from "@/services/ai/provider";

import type {
  RiskFinding,
  RiskLevel,
  RegulatoryDomain,
  EffectiveDateCheck,
} from "@/services/risk-engine/schema";

import {
  getEffectiveDateStatus,
  effectiveDateStatusLabels,
  getCoverageStatus,
  coverageLabels,
} from "@/services/risk-engine";

import { regulations } from "@/services/regulations";

interface MockFinding {
  id: string;
  category: string;
  riskLevel: "LOW" | "REVIEW" | "HIGH" | "INSUFFICIENT_EVIDENCE";
  title: string;
  summary: string;
  reason: string;
  requiredEvidence: string[];
  recommendedAction: string;
  jurisdiction: string;
  regulationId?: string;
  effectiveFrom?: string;
  shipmentDate?: string;
  effectiveDateStatus?: string;
  hsCode?: string;
}

const CATEGORY_TO_DOMAIN: Record<string, RegulatoryDomain> = {
  Sustainability: "CBAM",
  "Market Access": "MARKET_ACCESS",
  "Export Control": "EXPORT_CONTROL",
  "Sanctions & Restricted Parties": "SANCTIONS",
  "Tariff & Trade Remedy": "CUSTOMS_TARIFF",
  "Regulatory Coverage": "OTHER",
  "Product Safety": "PRODUCT_SAFETY",
  "Food Contact": "FOOD_CONTACT",
  "Customs & Classification": "PRODUCT_CLASSIFICATION",
};

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function toSchemaRiskLevel(level: MockFinding["riskLevel"]): RiskLevel {
  if (level === "HIGH") return "HIGH";
  if (level === "REVIEW") return "REVIEW";
  if (level === "INSUFFICIENT_EVIDENCE") return "REVIEW";
  return "LOW";
}

function toSchemaEffectiveDateStatus(status: string) {
  return status as
    | "NOT_YET_EFFECTIVE"
    | "ACTIVE"
    | "TRANSITIONAL"
    | "EXPIRED_OR_SUPERSEDED";
}

function findingSide(
  jurisdiction: string,
  exportJurisdiction: string,
  destinationJurisdiction: string,
): "EXPORT" | "DESTINATION" | "CROSS_BORDER" {
  const EU_MEMBERS = [
    "germany", "france", "italy", "spain", "netherlands",
    "european union", "eu",
  ];
  const jur = jurisdiction.toLowerCase();
  const dest = destinationJurisdiction.toLowerCase();

  if (jur === exportJurisdiction.toLowerCase())
    return "EXPORT";
  if (jur === dest)
    return "DESTINATION";
  // EU-wide regulations apply to any EU member state destination
  if (jur === "european union" && EU_MEMBERS.includes(dest))
    return "DESTINATION";
  return "CROSS_BORDER";
}

/**
 * Runs the existing generic mock risk-analysis logic.
 *
 * This logic is NOT product-specific. It uses jurisdiction, HS-code chapter,
  coverage status, and deterministic effective-date checks — the same
 * architecture that will later receive real AI findings from Nebius.
 */
function runMockAnalysis(ctx: AIAnalysisContext): {
  mockFindings: MockFinding[];
  nextActions: string[];
  reliefText: string;
} {
  const mockFindings: MockFinding[] = [];
  const nextActions: string[] = [];
  let reliefText = "No relief pathway identified for this shipment.";

  const s = ctx.shipment;
  const dest = s.destinationJurisdiction.toLowerCase();
  const hasDate = !!s.plannedImportDate;
  const exportCoverage = getCoverageStatus(s.exportJurisdiction);

  // Coverage finding (export-side)
  if (exportCoverage !== "PRIORITY_COVERAGE") {
    const label = coverageLabels[exportCoverage];
    mockFindings.push({
      id: "f-coverage-export",
      category: "Regulatory Coverage",
      riskLevel:
        exportCoverage === "INSUFFICIENT_EVIDENCE"
          ? "INSUFFICIENT_EVIDENCE"
          : "LOW",
      title: `Export-side coverage: ${label}`,
      summary: `Exporting from ${s.exportJurisdiction}. ${label}.`,
      reason:
        exportCoverage === "LIMITED_COVERAGE"
          ? "The jurisdiction is not yet part of ERC AI's curated priority regulatory dataset. ERC AI may still analyze available official sources and identify potential risks."
          : "ERC AI cannot find enough reliable regulatory evidence to support a conclusion for this export jurisdiction.",
      requiredEvidence:
        exportCoverage === "INSUFFICIENT_EVIDENCE"
          ? ["Human review recommended"]
          : [],
      recommendedAction:
        exportCoverage === "LIMITED_COVERAGE"
          ? "Continue with best-effort analysis. Verify findings with local authorities where possible."
          : "Do not rely on automated conclusions. Engage a qualified compliance adviser for this jurisdiction.",
      jurisdiction: s.exportJurisdiction,
    });
  }

  // 1. Jurisdiction + 2. Product/HS scope + 3. Effective date (deterministic)
  if (dest.includes("united kingdom") || dest === "uk") {
    const ukCbam = regulations.find((r) => r.id === "uk-cbam")!;

    if (hasDate) {
      const status = getEffectiveDateStatus(
        s.plannedImportDate,
        ukCbam.effectiveFrom,
      );
      const statusLabel = effectiveDateStatusLabels[status];

      if (status === "ACTIVE") {
        mockFindings.push({
          id: "f-cbam-uk",
          category: "Sustainability",
          riskLevel: "REVIEW",
          title: "UK CBAM is active for the planned import date",
          summary: `UK CBAM is active. Effective Date: ${formatDateLong(ukCbam.effectiveFrom)}. Shipment Date: ${formatDateLong(s.plannedImportDate)}. Effective Date Status: ${statusLabel}.`,
          reason:
            "The planned import date is after the UK CBAM effective date. Continue with product-scope, importer-obligation, threshold, emissions-evidence, and carbon-pricing checks.",
          requiredEvidence: [
            "Verified embedded-emissions data",
            "Carbon-pricing evidence",
            "Supplier / production information",
            "Product conformity documents",
          ],
          recommendedAction:
            "Confirm product scope, importer obligations, and threshold applicability. Collect emissions and carbon-pricing evidence before shipment.",
          jurisdiction: "United Kingdom",
          regulationId: "uk-cbam",
          effectiveFrom: ukCbam.effectiveFrom,
          shipmentDate: s.plannedImportDate,
          effectiveDateStatus: status,
          hsCode: s.hsCode,
        });
        nextActions.push(
          "Obtain verified embedded-emissions data for the products.",
          "Gather evidence of any eligible carbon price paid in the export jurisdiction, if applicable, and retain supporting documents.",
          "Provide required documentation to the UK importer.",
          "Review product standards and import requirements for the UK market.",
          "Keep records for future verification and potential audits.",
        );
        reliefText =
          "Possible carbon-price relief subject to supporting evidence.";
      } else if (status === "NOT_YET_EFFECTIVE") {
        mockFindings.push({
          id: "f-cbam-uk",
          category: "Sustainability",
          riskLevel: "LOW",
          title: "UK CBAM is not yet in force for this planned import date",
          summary: `UK CBAM becomes effective on ${formatDateLong(ukCbam.effectiveFrom)}. This shipment date precedes the effective date. Effective Date Status: ${statusLabel}.`,
          reason:
            "The planned import date is before the UK CBAM effective date. This is not an active CBAM compliance obligation. Monitor regulatory developments and prepare in advance.",
          requiredEvidence: ["Monitor regulatory updates"],
          recommendedAction:
            "Monitor / Prepare. No immediate CBAM compliance obligation for this shipment date. Track UK CBAM developments for future shipments on or after the effective date.",
          jurisdiction: "United Kingdom",
          regulationId: "uk-cbam",
          effectiveFrom: ukCbam.effectiveFrom,
          shipmentDate: s.plannedImportDate,
          effectiveDateStatus: status,
          hsCode: s.hsCode,
        });
        nextActions.push(
          "No immediate UK CBAM obligation for this shipment date.",
          "Monitor UK CBAM developments for future shipments on or after 1 January 2027.",
          "Consider voluntary preparation of emissions data for future compliance readiness.",
        );
      }
    } else {
      mockFindings.push({
        id: "f-cbam-uk",
        category: "Sustainability",
        riskLevel: "INSUFFICIENT_EVIDENCE",
        title: "UK CBAM effective-date check requires a planned import date",
        summary:
          "A planned import date is required to determine whether UK CBAM is active, upcoming, or not applicable.",
        reason:
          "Without a planned import date, ERC AI cannot determine the effective-date status of UK CBAM for this shipment.",
        requiredEvidence: ["Planned Import / Entry Date"],
        recommendedAction:
          "Provide a planned import date so the effective-date check can run.",
        jurisdiction: "United Kingdom",
        regulationId: "uk-cbam",
        effectiveFrom: ukCbam.effectiveFrom,
        hsCode: s.hsCode,
      });
    }
  } else if (
    dest.includes("germany") ||
    dest.includes("european union") ||
    dest.includes("eu")
  ) {
    const euCbam = regulations.find((r) => r.id === "eu-cbam")!;

    if (hasDate) {
      const status = getEffectiveDateStatus(
        s.plannedImportDate,
        euCbam.effectiveFrom,
        undefined,
        "2023-10-01",
        "2025-12-31",
      );
      const statusLabel = effectiveDateStatusLabels[status];

      if (status === "ACTIVE") {
        mockFindings.push({
          id: "f-cbam-eu",
          category: "Sustainability",
          riskLevel: "REVIEW",
          title: "EU CBAM definitive regime is active for this planned import date",
          summary: `EU CBAM definitive regime is active. Effective Date: ${formatDateLong(euCbam.effectiveFrom)}. Shipment Date: ${formatDateLong(s.plannedImportDate)}. Effective Date Status: ${statusLabel}.`,
          reason:
            "The planned import date falls within the EU CBAM definitive regime. Importers must report embedded emissions and may need to purchase CBAM certificates.",
          requiredEvidence: [
            "Verified embedded-emissions data",
            "CBAM certificate purchase evidence",
            "Supplier / production information",
            "Product conformity documents",
          ],
          recommendedAction:
            "Confirm product scope and importer obligations under the EU CBAM definitive regime. Collect emissions evidence and ensure CBAM certificate compliance.",
          jurisdiction: "European Union",
          regulationId: "eu-cbam",
          effectiveFrom: euCbam.effectiveFrom,
          shipmentDate: s.plannedImportDate,
          effectiveDateStatus: status,
          hsCode: s.hsCode,
        });
        nextActions.push(
          "Obtain verified embedded-emissions data for the products.",
          "Ensure the EU importer purchases and surrenders CBAM certificates as required.",
          "Provide required documentation to the EU importer.",
          "Review product standards and import requirements for the EU market.",
          "Keep records for future verification and potential audits.",
        );
        reliefText =
          "Possible carbon-price relief subject to supporting evidence of carbon price paid at origin.";
      } else if (status === "TRANSITIONAL") {
        mockFindings.push({
          id: "f-cbam-eu",
          category: "Sustainability",
          riskLevel: "REVIEW",
          title: "EU CBAM transitional reporting period applies",
          summary: `The planned import date falls within the EU CBAM transitional period (1 October 2023 – 31 December 2025). Effective Date Status: ${statusLabel}.`,
          reason:
            "During the transitional period, importers must report embedded emissions but are not required to purchase CBAM certificates. Prepare for the definitive regime starting 1 January 2026.",
          requiredEvidence: [
            "Quarterly emissions report",
            "Supplier / production information",
          ],
          recommendedAction:
            "Ensure the EU importer files quarterly CBAM emissions reports. Prepare for definitive regime obligations.",
          jurisdiction: "European Union",
          regulationId: "eu-cbam",
          effectiveFrom: "2023-10-01",
          shipmentDate: s.plannedImportDate,
          effectiveDateStatus: status,
          hsCode: s.hsCode,
        });
        nextActions.push(
          "Ensure the EU importer files quarterly CBAM emissions reports.",
          "Prepare emissions data collection for the definitive regime.",
          "Review product standards and import requirements for the EU market.",
        );
        reliefText =
          "No certificate purchase required during transitional period. Reporting only.";
      } else if (status === "NOT_YET_EFFECTIVE") {
        mockFindings.push({
          id: "f-cbam-eu",
          category: "Sustainability",
          riskLevel: "LOW",
          title: "EU CBAM is not yet in force for this planned import date",
          summary: `EU CBAM becomes effective on ${formatDateLong(euCbam.effectiveFrom)}. This shipment date precedes the effective date. Effective Date Status: ${statusLabel}.`,
          reason:
            "The planned import date is before the EU CBAM effective date. Monitor regulatory developments and prepare in advance.",
          requiredEvidence: ["Monitor regulatory updates"],
          recommendedAction:
            "Monitor / Prepare. No immediate CBAM obligation for this shipment date. Track EU CBAM developments for future shipments.",
          jurisdiction: "European Union",
          regulationId: "eu-cbam",
          effectiveFrom: euCbam.effectiveFrom,
          shipmentDate: s.plannedImportDate,
          effectiveDateStatus: status,
          hsCode: s.hsCode,
        });
        nextActions.push(
          "No immediate EU CBAM obligation for this shipment date.",
          "Monitor EU CBAM developments for future shipments.",
        );
      }
    } else {
      mockFindings.push({
        id: "f-cbam-eu",
        category: "Sustainability",
        riskLevel: "INSUFFICIENT_EVIDENCE",
        title: "EU CBAM effective-date check requires a planned import date",
        summary:
          "A planned import date is required to determine whether EU CBAM is active, transitional, or not applicable.",
        reason:
          "Without a planned import date, ERC AI cannot determine the effective-date status of EU CBAM for this shipment.",
        requiredEvidence: ["Planned Import / Entry Date"],
        recommendedAction:
          "Provide a planned import date so the effective-date check can run.",
        jurisdiction: "European Union",
        regulationId: "eu-cbam",
        effectiveFrom: euCbam.effectiveFrom,
        hsCode: s.hsCode,
      });
    }
  }

  // Market access / importer obligation
  mockFindings.push({
    id: "f2",
    category: "Market Access",
    riskLevel: "LOW",
    title: "Importer obligations identified",
    summary: `The importer in ${s.destinationJurisdiction} may be the responsible economic operator for local requirements.`,
    reason: `Market access responsibilities commonly sit with the importer in the destination market (${s.destinationJurisdiction}).`,
    requiredEvidence: ["Importer responsibility confirmation"],
    recommendedAction:
      "Confirm the importer has the required product and labelling records.",
    jurisdiction: s.destinationJurisdiction,
  });

  // Export control classification review
  mockFindings.push({
    id: "f3",
    category: "Export Control",
    riskLevel: "REVIEW",
    title: "Classification evidence recommended",
    summary: `The HS code and product characteristics should be reviewed against ${s.exportJurisdiction} export-control lists.`,
    reason: `A classification review against ${s.exportJurisdiction} export-control and dual-use lists is needed before relying on an export-control conclusion.`,
    requiredEvidence: ["Product specification sheet", "Classification rationale"],
    recommendedAction: `Obtain a documented classification review against ${s.exportJurisdiction} export-control lists for the shipment.`,
    jurisdiction: s.exportJurisdiction,
  });

  if (!nextActions.length) {
    nextActions.push(
      "Review applicable regulations for the destination market.",
      "Confirm importer obligations and required documentation.",
      "Keep records for future verification.",
    );
  }

  return { mockFindings, nextActions, reliefText };
}

/**
 * Converts mock findings to schema RiskFinding[].
 *
 * Source IDs are assigned by the deterministic layer (index.ts) and passed
 * in via the regulatoryContext. The mock provider maps them to findings
 * based on side (export/destination).
 */
function buildFindings(
  mockFindings: MockFinding[],
  ctx: AIAnalysisContext,
): RiskFinding[] {
  const s = ctx.shipment;
  return mockFindings.map((mf) => {
    const side = findingSide(
      mf.jurisdiction,
      s.exportJurisdiction,
      s.destinationJurisdiction,
    );
    const sourceIds: string[] = [];

    let effectiveDateCheck: EffectiveDateCheck | undefined;
    if (mf.effectiveFrom && mf.effectiveDateStatus && mf.shipmentDate) {
      const reg = regulations.find((r) => r.id === mf.regulationId);
      effectiveDateCheck = {
        regulationName: reg?.title || mf.regulationId || "Unknown regulation",
        effectiveFrom: mf.effectiveFrom,
        effectiveTo: reg?.effectiveTo,
        plannedImportDate: mf.shipmentDate,
        status: toSchemaEffectiveDateStatus(mf.effectiveDateStatus),
        explanation: `Effective Date Status: ${effectiveDateStatusLabels[mf.effectiveDateStatus as keyof typeof effectiveDateStatusLabels]}.`,
      };
    }

    const domain = CATEGORY_TO_DOMAIN[mf.category] || "OTHER";
    const riskLevel = toSchemaRiskLevel(mf.riskLevel);
    const requiresHumanReview =
      mf.riskLevel === "INSUFFICIENT_EVIDENCE" || mf.riskLevel === "HIGH";

    const missingEvidence = mf.requiredEvidence.filter(
      () =>
        mf.riskLevel === "INSUFFICIENT_EVIDENCE" ||
        mf.riskLevel === "REVIEW",
    );

    return {
      id: mf.id,
      domain,
      title: mf.title,
      riskLevel,
      jurisdiction: mf.jurisdiction,
      side,
      regulationName: mf.regulationId
        ? regulations.find((r) => r.id === mf.regulationId)?.title
        : undefined,
      reason: mf.reason,
      effectiveDateCheck,
      requiredEvidence: mf.requiredEvidence,
      missingEvidence,
      recommendedActions: [mf.recommendedAction],
      sourceIds,
      confidence:
        mf.riskLevel === "INSUFFICIENT_EVIDENCE"
          ? 0.3
          : mf.riskLevel === "REVIEW"
            ? 0.6
            : 0.8,
      requiresHumanReview,
    };
  });
}

/**
 * Mock AI provider — generates findings using the existing generic
 * jurisdiction-aware mock logic. No product-specific hard-coded cases.
 */
export const mockAIProvider: AIProvider = {
  name: "mock",

  async analyze(context: AIAnalysisContext): Promise<AIAnalysisResult> {
    const { mockFindings, nextActions, reliefText } = runMockAnalysis(context);

    const findings = buildFindings(mockFindings, context);

    // Stash nextActions and reliefText on the findings via a side channel
    // so the deterministic layer can retrieve them without duplicating logic.
    (findings as unknown as { _nextActions?: string[]; _reliefText?: string })._nextActions = nextActions;
    (findings as unknown as { _nextActions?: string[]; _reliefText?: string })._reliefText = reliefText;

    return {
      findings,
      provider: "mock",
    };
  },
};
