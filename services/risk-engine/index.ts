import { CoverageStatus, EffectiveDateStatus, RiskLevel } from '@/lib/models';

export const riskLabels: Record<RiskLevel, string> = {
  LOW: 'Low Risk',
  REVIEW: 'Review Recommended',
  HIGH: 'High Risk',
  INSUFFICIENT_EVIDENCE: 'Insufficient Evidence',
};

export const effectiveDateStatusLabels: Record<EffectiveDateStatus, string> = {
  NOT_YET_EFFECTIVE: 'UPCOMING',
  ACTIVE: 'ACTIVE',
  TRANSITIONAL: 'TRANSITIONAL',
  EXPIRED_OR_SUPERSEDED: 'EXPIRED / SUPERSEDED',
};

export const coverageLabels: Record<CoverageStatus, string> = {
  PRIORITY_COVERAGE: 'Priority Regulatory Coverage',
  LIMITED_COVERAGE: 'Limited Coverage — Best-Effort Regulatory Research',
  INSUFFICIENT_EVIDENCE: 'Insufficient Evidence — Human Review Recommended',
};

/** Priority jurisdictions with curated regulatory sources. */
export const priorityJurisdictions: string[] = [
  'Taiwan',
  'United States',
  'United Kingdom',
  'Singapore',
  'Japan',
  'Canada',
  'Australia',
  'South Korea',
];

/** Extended country/territory list for the selector. New entries can be added freely. */
export const allCountries: string[] = [
  'Taiwan', 'United States', 'United Kingdom', 'Singapore', 'Japan', 'Canada', 'Australia', 'South Korea',
  'Argentina', 'Bangladesh', 'Brazil', 'Cambodia', 'Chile', 'China', 'Colombia', 'Costa Rica', 'Ecuador', 'Egypt',
  'European Union', 'France', 'Germany', 'Ghana', 'Greece', 'Hong Kong', 'India', 'Indonesia', 'Ireland', 'Israel',
  'Italy', 'Kenya', 'Kuwait', 'Laos', 'Malaysia', 'Mexico', 'Morocco', 'Netherlands', 'New Zealand', 'Nigeria',
  'Norway', 'Pakistan', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Russia', 'Saudi Arabia', 'South Africa',
  'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Thailand', 'Turkey', 'Ukraine', 'United Arab Emirates',
  'Vietnam', 'Zambia',
];

export function getCoverageStatus(jurisdiction: string): CoverageStatus {
  const normalized = jurisdiction.toLowerCase().trim();
  if (!normalized) return 'INSUFFICIENT_EVIDENCE';
  const isPriority = priorityJurisdictions.some((j) => j.toLowerCase() === normalized);
  if (isPriority) return 'PRIORITY_COVERAGE';
  // Known jurisdictions with some available official sources → limited coverage
  const knownCountry = allCountries.some((c) => c.toLowerCase() === normalized);
  if (knownCountry) return 'LIMITED_COVERAGE';
  // Anything else — still attempt analysis, but flag insufficient evidence
  return 'LIMITED_COVERAGE';
}

/**
 * Deterministic effective-date check. This is NOT AI logic.
 * The UI must never ask an AI model whether a regulation is in force.
 *
 * shipment date before effectiveFrom → NOT_YET_EFFECTIVE
 * shipment date on or after effectiveFrom → ACTIVE
 * shipment date after effectiveTo → EXPIRED_OR_SUPERSEDED
 *
 * If a regulation defines a transitional period (effectiveTo on a transitional
 * regulation), and the shipment falls within that window, returns TRANSITIONAL.
 */
export function getEffectiveDateStatus(
  plannedImportDate: string,
  effectiveFrom: string,
  effectiveTo?: string,
  transitionalFrom?: string,
  transitionalTo?: string,
): EffectiveDateStatus {
  const shipment = new Date(plannedImportDate).getTime();
  const from = new Date(effectiveFrom).getTime();

  if (transitionalFrom && transitionalTo) {
    const transFrom = new Date(transitionalFrom).getTime();
    const transTo = new Date(transitionalTo).getTime();
    if (shipment >= transFrom && shipment <= transTo) {
      return 'TRANSITIONAL';
    }
  }

  if (effectiveTo) {
    const to = new Date(effectiveTo).getTime();
    if (shipment > to) {
      return 'EXPIRED_OR_SUPERSEDED';
    }
  }

  if (shipment < from) {
    return 'NOT_YET_EFFECTIVE';
  }

  return 'ACTIVE';
}

import { RiskFinding, RiskSummary, OverallAssessment } from '@/services/risk-engine/schema';

/**
 * Calculates the RiskSummary from a list of findings.
 * Counts LOW / REVIEW / HIGH findings and derives overallAssessment.
 * No fixed values — all counts are computed from the findings array.
 *
 * Guardrail 1: An empty findings array is treated as INSUFFICIENT_EVIDENCE,
 *   not LOW_RISK. "No findings" means the system could not find enough
 *   evidence to conclude low risk — it does not mean the shipment is safe.
 *
 * Guardrail 2 (consistency): If requiresHumanReview is true but all findings
 *   are LOW, the overall assessment is overridden to INSUFFICIENT_EVIDENCE
 *   so the user never sees a bare "Low Risk" when human review is needed.
 */
export function buildRiskSummary(
  findings: RiskFinding[],
  requiresHumanReview?: boolean,
): RiskSummary {
  const low = findings.filter((f) => f.riskLevel === 'LOW').length;
  const review = findings.filter((f) => f.riskLevel === 'REVIEW').length;
  const high = findings.filter((f) => f.riskLevel === 'HIGH').length;

  let overallAssessment: OverallAssessment;

  if (findings.length === 0) {
    overallAssessment = 'INSUFFICIENT_EVIDENCE';
  } else if (high > 0) {
    overallAssessment = 'HIGH_RISK';
  } else if (review > 0) {
    overallAssessment = 'REVIEW_RECOMMENDED';
  } else if (requiresHumanReview && low === findings.length) {
    overallAssessment = 'INSUFFICIENT_EVIDENCE';
  } else {
    overallAssessment = 'LOW_RISK';
  }

  return { low, review, high, overallAssessment };
}
