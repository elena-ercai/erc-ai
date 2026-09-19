import { OfficialSource } from '@/lib/models';

export type SourceSide = 'export' | 'destination';

/**
 * Regulatory domains — broad categories of regulation that a source authority
 * covers. These represent regulatory domains, NOT specific products or test
 * cases. The analysis engine detects which domains are relevant to a shipment
 * from the shipment's facts (HS code, product characteristics, intended use)
 * and surfaces sources whose `regulatoryDomains` intersect with the detected
 * set.
 *
 * Examples of valid domains:
 *   CUSTOMS_TARIFF, EXPORT_CONTROL, SANCTIONS, FOOD_CONTACT,
 *   PRODUCT_SAFETY, CBAM, TRADE_REMEDY, ORIGIN_MARKING, MARKET_ACCESS
 */
export type RegulatoryDomain =
  | 'CUSTOMS_TARIFF'
  | 'EXPORT_CONTROL'
  | 'SANCTIONS'
  | 'FOOD_CONTACT'
  | 'PRODUCT_SAFETY'
  | 'CBAM'
  | 'TRADE_REMEDY'
  | 'ORIGIN_MARKING'
  | 'MARKET_ACCESS'
  | 'COVERAGE';

export interface JurisdictionSource extends OfficialSource {
  side: SourceSide;
  jurisdiction: string;
  /** Regulatory domains this source authority covers. '*' = always relevant. */
  regulatoryDomains: (RegulatoryDomain | '*')[];
  legalInstrument?: string;
  citation?: string;
  relevantProvision?: string;
  directSourceUrl?: string;
  sourceGranularity?: "LEGAL_PROVISION" | "SPECIFIC_GUIDANCE" | "GENERAL_AUTHORITY";
}

/** Finding categories that map to regulatory domains. */
export type FindingCategory =
  | 'Sustainability'
  | 'Market Access'
  | 'Export Control'
  | 'Sanctions & Restricted Parties'
  | 'Tariff & Trade Remedy'
  | 'Regulatory Coverage'
  | 'Product Safety'
  | 'Food Contact'
  | 'Customs & Classification';

const CATEGORY_MAP: Record<FindingCategory, RegulatoryDomain> = {
  'Sustainability': 'CBAM',
  'Market Access': 'MARKET_ACCESS',
  'Export Control': 'EXPORT_CONTROL',
  'Sanctions & Restricted Parties': 'SANCTIONS',
  'Tariff & Trade Remedy': 'CUSTOMS_TARIFF',
  'Regulatory Coverage': 'COVERAGE',
  'Product Safety': 'PRODUCT_SAFETY',
  'Food Contact': 'FOOD_CONTACT',
  'Customs & Classification': 'CUSTOMS_TARIFF',
};

export function findingCategoryToDomain(category: string): RegulatoryDomain | null {
  return CATEGORY_MAP[category as FindingCategory] || null;
}

/**
 * Detects regulatory domains from shipment facts — NOT from product names.
 *
 * This function examines the product's HS code, characteristics, and intended
 * use to infer which broad regulatory domains may apply. It does NOT match
 * specific product names (e.g. "bowl", "stainless steel") to specific sources.
 *
 * HS-code prefix matching is used because HS chapters are standardized:
 *   - Chapter 73 (articles of iron/steel) → may include food-contact items
 *   - Chapter 69/70 (ceramic/glass tableware) → FOOD_CONTACT
 *   - Chapter 39 (plastics) → FOOD_CONTACT if described as food-contact
 *   - Chapter 84/85 (machinery/electronics) → EXPORT_CONTROL (dual-use potential)
 *   - Chapter 28/29/30/31/38 (chemicals) → PRODUCT_SAFETY, EXPORT_CONTROL
 *   - Chapter 76 (aluminum) → CBAM (carbon-intensive material)
 *
 * Characteristics text is scanned for regulatory-domain trigger phrases
 * (e.g. "intended for direct food contact" → FOOD_CONTACT), not for
 * product names.
 */
export function detectRegulatoryDomains(shipment: {
  productName: string;
  productCategory: string;
  productCharacteristics: string;
  hsCode: string;
}): Set<RegulatoryDomain> {
  const domains = new Set<RegulatoryDomain>();
  const characteristics = shipment.productCharacteristics.toLowerCase();
  const hsCode = shipment.hsCode.replace(/[.\s]/g, '');

  // HS-chapter-based domain detection
  const chapter = hsCode.substring(0, 2);

  // Food-contact: tableware/kitchenware chapters
  if (['69', '70', '73'].includes(chapter)) {
    // Ceramic, glass, steel tableware/kitchenware — may be food-contact
    // Only trigger FOOD_CONTACT if characteristics confirm intended use
    if (characteristics.includes('food contact') || characteristics.includes('food-contact') ||
        characteristics.includes('intended for food') || characteristics.includes('food use') ||
        characteristics.includes('kitchen') || characteristics.includes('tableware') ||
        characteristics.includes('cookware') || characteristics.includes('utensil')) {
      domains.add('FOOD_CONTACT');
    }
  }
  if (['39'].includes(chapter)) {
    // Plastic articles — food-contact only if described as such
    if (characteristics.includes('food contact') || characteristics.includes('food-contact') ||
        characteristics.includes('intended for food')) {
      domains.add('FOOD_CONTACT');
    }
  }

  // Dual-use / export control: machinery, electronics, chemicals
  if (['84', '85', '90'].includes(chapter)) {
    domains.add('EXPORT_CONTROL');
  }
  if (['28', '29', '30', '31', '38'].includes(chapter)) {
    domains.add('PRODUCT_SAFETY');
    domains.add('EXPORT_CONTROL');
  }

  // CBAM: carbon-intensive materials (iron/steel, aluminum, cement, fertilizer, hydrogen, electricity)
  if (['72', '73', '76'].includes(chapter)) {
    domains.add('CBAM');
  }
  if (['25'].includes(chapter)) domains.add('CBAM'); // cement
  if (['28', '31'].includes(chapter)) {
    // fertilizers / hydrogen — already has PRODUCT_SAFETY
    domains.add('CBAM');
  }

  // Trade remedy: iron/steel, aluminum often subject to anti-dumping/countervailing
  if (['72', '73', '76'].includes(chapter)) {
    domains.add('TRADE_REMEDY');
  }

  // Origin marking: certain product categories commonly require country-of-origin marking
  if (['61', '62', '64', '94'].includes(chapter)) {
    domains.add('ORIGIN_MARKING');
  }

  // Characteristics-based domain detection (regulatory trigger phrases, not product names)
  if (characteristics.includes('food contact') || characteristics.includes('food-contact') ||
      characteristics.includes('intended for food') || characteristics.includes('food use')) {
    domains.add('FOOD_CONTACT');
  }
  if (characteristics.includes('dual use') || characteristics.includes('dual-use') ||
      characteristics.includes('strategic') || characteristics.includes('military')) {
    domains.add('EXPORT_CONTROL');
  }
  if (characteristics.includes('sanctioned') || characteristics.includes('restricted party') ||
      characteristics.includes('denied party')) {
    domains.add('SANCTIONS');
  }
  if (characteristics.includes('hazardous') || characteristics.includes('toxic') ||
      characteristics.includes('flammable') || characteristics.includes('chemical')) {
    domains.add('PRODUCT_SAFETY');
  }

  return domains;
}

/**
 * Jurisdiction-aware official-source catalog.
 *
 * Sources are keyed by jurisdiction and tagged as either export-side or
 * destination-side. The analysis engine pulls from this catalog based on the
 * shipment's exportingCountry and destinationCountry — never from a single
 * global static list.
 *
 * Each source is tagged with the regulatory domains its authority covers.
 * Sources with '*' are always surfaced for that jurisdiction. Other sources
 * appear only when a matching regulatory domain has been detected from the
 * shipment facts or finding categories.
 */
export const jurisdictionSources: Record<string, JurisdictionSource[]> = {
  'United States': [
    { id: 'us-htsus', side: 'destination', jurisdiction: 'United States', name: 'U.S. International Trade Commission', title: 'Harmonized Tariff Schedule of the United States (HTSUS)', url: 'https://hts.usitc.gov', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', '*'] },
    { id: 'us-cbp', side: 'destination', jurisdiction: 'United States', name: 'U.S. Customs and Border Protection', title: 'Import, tariff, and trade-remedy guidance', url: 'https://www.cbp.gov/trade', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', 'TRADE_REMEDY', 'MARKET_ACCESS', '*'] },
    { id: 'us-fda', side: 'destination', jurisdiction: 'United States', name: 'U.S. Food and Drug Administration', title: 'Food-contact and product-safety regulatory information', url: 'https://www.fda.gov', official: true, regulatoryDomains: ['FOOD_CONTACT', 'PRODUCT_SAFETY'] },
    { id: 'us-bis', side: 'destination', jurisdiction: 'United States', name: 'U.S. Bureau of Industry and Security', title: 'Export Administration Regulations (EAR) — dual-use controls', url: 'https://www.bis.doc.gov', official: true, regulatoryDomains: ['EXPORT_CONTROL'] },
    { id: 'us-trade', side: 'destination', jurisdiction: 'United States', name: 'U.S. International Trade Administration', title: 'Import requirements and trade compliance guidance', url: 'https://www.trade.gov', official: true, regulatoryDomains: ['MARKET_ACCESS', 'TRADE_REMEDY', 'CUSTOMS_TARIFF'] },
  ],
  'United Kingdom': [
    { id: 'uk-cbam-act', side: 'destination', jurisdiction: 'United Kingdom', name: 'UK Government', title: 'Carbon Border Adjustment Mechanism — UK legislation', url: 'https://www.gov.uk/government/publications/uk-carbon-border-adjustment-mechanism', official: true, regulatoryDomains: ['CBAM'], legalInstrument: 'UK CBAM (planned effective 1 January 2027)', relevantProvision: 'Scope of goods and importer obligations', directSourceUrl: 'https://www.gov.uk/government/publications/uk-carbon-border-adjustment-mechanism', sourceGranularity: 'SPECIFIC_GUIDANCE' },
    { id: 'uk-hmrc', side: 'destination', jurisdiction: 'United Kingdom', name: 'HMRC', title: 'UK import, tariff, and customs guidance', url: 'https://www.gov.uk/government/organisations/hm-revenue-customs', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', 'MARKET_ACCESS', '*'], sourceGranularity: 'GENERAL_AUTHORITY' },
    { id: 'uk-gov', side: 'destination', jurisdiction: 'United Kingdom', name: 'UK Government', title: 'Trade and import regulations', url: 'https://www.gov.uk', official: true, regulatoryDomains: ['MARKET_ACCESS', '*'], sourceGranularity: 'GENERAL_AUTHORITY' },
    { id: 'uk-ecju', side: 'export', jurisdiction: 'United Kingdom', name: 'UK Export Control Joint Unit', title: 'Strategic export controls and licensing', url: 'https://www.gov.uk/government/organisations/export-control-joint-unit', official: true, regulatoryDomains: ['EXPORT_CONTROL'], sourceGranularity: 'GENERAL_AUTHORITY' },
    { id: 'uk-ofsi', side: 'export', jurisdiction: 'United Kingdom', name: 'Office of Financial Sanctions Implementation', title: 'UK financial sanctions and restricted-party screening', url: 'https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation', official: true, regulatoryDomains: ['SANCTIONS'], sourceGranularity: 'GENERAL_AUTHORITY' },
  ],
  'European Union': [
    { id: 'eu-cbam-regulation', side: 'destination', jurisdiction: 'European Union', name: 'EUR-Lex', title: 'Regulation (EU) 2023/956 — Carbon Border Adjustment Mechanism', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956', official: true, regulatoryDomains: ['CBAM'], legalInstrument: 'Regulation (EU) 2023/956', citation: 'OJ L 130, 16.5.2023', relevantProvision: 'Annex I — Goods in scope of CBAM', directSourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956', sourceGranularity: 'LEGAL_PROVISION' },
    { id: 'eu-cbam-definitive', side: 'destination', jurisdiction: 'European Union', name: 'European Commission', title: 'CBAM Definitive Regime — Implementation guidance', url: 'https://taxation-customs.ec.europa.eu/customs-4/carbon-border-adjustment-mechanism_en', official: true, regulatoryDomains: ['CBAM'], legalInstrument: 'Regulation (EU) 2023/956', relevantProvision: 'Definitive regime applicable from 1 January 2026', directSourceUrl: 'https://taxation-customs.ec.europa.eu/customs-4/carbon-border-adjustment-mechanism_en', sourceGranularity: 'SPECIFIC_GUIDANCE' },
    { id: 'eu-commission', side: 'destination', jurisdiction: 'European Union', name: 'European Commission', title: 'EU trade and import regulations', url: 'https://ec.europa.eu', official: true, regulatoryDomains: ['MARKET_ACCESS', '*'], sourceGranularity: 'GENERAL_AUTHORITY' },
    { id: 'eu-taxud', side: 'destination', jurisdiction: 'European Union', name: 'European Commission — Taxation and Customs Union', title: 'EU customs and tariff guidance', url: 'https://taxation-customs.ec.europa.eu', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', 'MARKET_ACCESS'], sourceGranularity: 'GENERAL_AUTHORITY' },
    { id: 'eu-export-control', side: 'export', jurisdiction: 'European Union', name: 'European Commission — Directorate-General for Trade', title: 'EU dual-use export controls', url: 'https://policy.trade.ec.europa.eu', official: true, regulatoryDomains: ['EXPORT_CONTROL'], sourceGranularity: 'GENERAL_AUTHORITY' },
  ],
  Germany: [
    { id: 'de-zoll-cbam', side: 'destination', jurisdiction: 'Germany', name: 'German Customs (Zoll)', title: 'CBAM implementation guidance for German importers', url: 'https://www.zoll.de/DE/Fachthemen/Zoelle/Schutzklauseln/CBAM/cbam_node.html', official: true, regulatoryDomains: ['CBAM'], legalInstrument: 'Regulation (EU) 2023/956', relevantProvision: 'Definitive regime — importer obligations in Germany', directSourceUrl: 'https://www.zoll.de/DE/Fachthemen/Zoelle/Schutzklauseln/CBAM/cbam_node.html', sourceGranularity: 'SPECIFIC_GUIDANCE' },
    { id: 'de-eu-cbam-regulation', side: 'destination', jurisdiction: 'European Union', name: 'EUR-Lex', title: 'Regulation (EU) 2023/956 — Carbon Border Adjustment Mechanism', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956', official: true, regulatoryDomains: ['CBAM'], legalInstrument: 'Regulation (EU) 2023/956', citation: 'OJ L 130, 16.5.2023', relevantProvision: 'Annex I — Goods in scope of CBAM (CN 7326, other articles of iron or steel)', directSourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956', sourceGranularity: 'LEGAL_PROVISION' },
    { id: 'de-bafa', side: 'export', jurisdiction: 'Germany', name: 'Bundesamt für Wirtschaft und Ausfuhrkontrolle (BAFA)', title: 'German export-control and dual-use licensing', url: 'https://www.bafa.de', official: true, regulatoryDomains: ['EXPORT_CONTROL'], sourceGranularity: 'GENERAL_AUTHORITY' },
    { id: 'de-zoll', side: 'destination', jurisdiction: 'Germany', name: 'German Customs (Zoll)', title: 'German import and customs guidance', url: 'https://www.zoll.de', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', 'MARKET_ACCESS', '*'], sourceGranularity: 'GENERAL_AUTHORITY' },
  ],
  Taiwan: [
    { id: 'tw-boft', side: 'export', jurisdiction: 'Taiwan', name: 'Bureau of Foreign Trade (Taiwan)', title: 'Taiwan export regulations and trade controls', url: 'https://www.trade.gov.tw', official: true, regulatoryDomains: ['MARKET_ACCESS', 'EXPORT_CONTROL', '*'] },
    { id: 'tw-customs', side: 'export', jurisdiction: 'Taiwan', name: 'Taiwan Customs Administration', title: 'Taiwan customs classification and export procedures', url: 'https://web.customs.gov.tw', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', '*'] },
    { id: 'tw-moea', side: 'export', jurisdiction: 'Taiwan', name: 'Ministry of Economic Affairs (Taiwan)', title: 'Strategic export-control and dual-use licensing', url: 'https://www.moea.gov.tw', official: true, regulatoryDomains: ['EXPORT_CONTROL'] },
  ],
  Singapore: [
    { id: 'sg-customs', side: 'export', jurisdiction: 'Singapore', name: 'Singapore Customs', title: 'Singapore export and customs controls', url: 'https://www.customs.gov.sg', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', 'MARKET_ACCESS', '*'] },
    { id: 'sg-mti', side: 'export', jurisdiction: 'Singapore', name: 'Ministry of Trade and Industry (Singapore)', title: 'Singapore trade and strategic-goods controls', url: 'https://www.mti.gov.sg', official: true, regulatoryDomains: ['EXPORT_CONTROL', 'MARKET_ACCESS'] },
  ],
  Japan: [
    { id: 'jp-metl', side: 'export', jurisdiction: 'Japan', name: 'Ministry of Economy, Trade and Industry (METI)', title: 'Japan export-control and trade regulations', url: 'https://www.meti.go.jp', official: true, regulatoryDomains: ['EXPORT_CONTROL', 'MARKET_ACCESS', '*'] },
    { id: 'jp-customs', side: 'export', jurisdiction: 'Japan', name: 'Japan Customs', title: 'Japan customs and tariff classification', url: 'https://www.customs.go.jp', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', '*'] },
  ],
  Canada: [
    { id: 'ca-cbsa', side: 'export', jurisdiction: 'Canada', name: 'Canada Border Services Agency', title: 'Canada export and import customs guidance', url: 'https://www.cbsa-asfc.gc.ca', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', 'MARKET_ACCESS', '*'] },
    { id: 'ca-gac', side: 'export', jurisdiction: 'Canada', name: 'Global Affairs Canada', title: 'Canada export controls and trade policy', url: 'https://www.international.gc.ca', official: true, regulatoryDomains: ['EXPORT_CONTROL', 'SANCTIONS'] },
  ],
  Australia: [
    { id: 'au-abf', side: 'export', jurisdiction: 'Australia', name: 'Australian Border Force', title: 'Australia export and import controls', url: 'https://www.abf.gov.au', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', 'MARKET_ACCESS', '*'] },
    { id: 'au-dfat', side: 'export', jurisdiction: 'Australia', name: 'Department of Foreign Affairs and Trade (Australia)', title: 'Australia strategic export controls and sanctions', url: 'https://www.dfat.gov.au', official: true, regulatoryDomains: ['EXPORT_CONTROL', 'SANCTIONS'] },
  ],
  'South Korea': [
    { id: 'kr-customs', side: 'export', jurisdiction: 'South Korea', name: 'Korea Customs Service', title: 'South Korea export and customs guidance', url: 'https://www.customs.go.kr', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', 'MARKET_ACCESS', '*'] },
    { id: 'kr-motie', side: 'export', jurisdiction: 'South Korea', name: 'Ministry of Trade, Industry and Energy (South Korea)', title: 'South Korea strategic export controls', url: 'https://www.motie.go.kr', official: true, regulatoryDomains: ['EXPORT_CONTROL'] },
  ],
  China: [
    { id: 'cn-customs', side: 'export', jurisdiction: 'China', name: 'General Administration of Customs (China)', title: 'China export and customs regulations', url: 'http://www.customs.gov.cn', official: true, regulatoryDomains: ['CUSTOMS_TARIFF', 'MARKET_ACCESS', '*'] },
    { id: 'cn-mofcom', side: 'export', jurisdiction: 'China', name: 'Ministry of Commerce (China)', title: 'China export-control and trade licensing', url: 'http://www.mofcom.gov.cn', official: true, regulatoryDomains: ['EXPORT_CONTROL', 'MARKET_ACCESS'] },
  ],
};

/**
 * Returns all official sources for a given jurisdiction and side.
 * Returns an empty array if the jurisdiction has no curated sources.
 */
export function getSourcesForJurisdiction(jurisdiction: string, side?: SourceSide): JurisdictionSource[] {
  const key = jurisdiction.trim();
  const entries = jurisdictionSources[key];
  if (!entries) return [];
  if (!side) return entries;
  return entries.filter((s) => s.side === side);
}

/**
 * Filters a list of jurisdiction sources to only those relevant to the
 * shipment's detected regulatory domains and generated finding categories.
 *
 * A source is included if:
 *   - It is tagged with '*' (always relevant for that jurisdiction), OR
 *   - One of its regulatoryDomains intersects with:
 *       (a) the domains detected from shipment facts, OR
 *       (b) the domains derived from generated finding categories.
 *
 * This preserves the architecture for the future live system:
 *   Shipment facts → regulatory-domain detection → official source retrieval
 *   Findings (when available) → additional domain tags → source citations
 *
 * Sources can be retrieved from shipment facts alone (via detected domains)
 * even before findings exist, so the system is not gated on findings being
 * generated first.
 */
export function filterSourcesByRelevance(
  entries: JurisdictionSource[],
  findingCategories: string[],
  shipment: { productName: string; productCategory: string; productCharacteristics: string; hsCode: string },
): JurisdictionSource[] {
  const detectedDomains = detectRegulatoryDomains(shipment);
  const findingDomains = new Set<RegulatoryDomain>();
  for (const cat of findingCategories) {
    const domain = findingCategoryToDomain(cat);
    if (domain) findingDomains.add(domain);
  }
  const relevantDomains = new Set<RegulatoryDomain>();
  detectedDomains.forEach((d) => relevantDomains.add(d));
  findingDomains.forEach((d) => relevantDomains.add(d));

  return entries.filter((entry) => {
    if (entry.regulatoryDomains.includes('*')) return true;
    return entry.regulatoryDomains.some((d) => relevantDomains.has(d as RegulatoryDomain));
  });
}

/**
 * Placeholder source used when no authoritative source has been retrieved yet.
 * The analysis engine uses this rather than substituting another country.
 */
export function unresolvedSource(id: string, jurisdiction: string, side: SourceSide): JurisdictionSource {
  return {
    id,
    side,
    jurisdiction,
    name: jurisdiction,
    title: side === 'export' ? 'Export-side official source not yet retrieved' : 'Destination-side official source not yet retrieved',
    url: '',
    official: false,
    regulatoryDomains: ['*'],
  };
}
