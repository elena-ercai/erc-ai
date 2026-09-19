import { Regulation } from '@/lib/models';

export const regulations: Regulation[] = [
  { id: 'uk-cbam', title: 'UK Carbon Border Adjustment Mechanism (UK CBAM)', jurisdiction: 'United Kingdom', category: 'Sustainability', summary: 'Applies to selected carbon-intensive goods. Importers may need embedded emissions data and carbon pricing evidence.', status: 'Upcoming', effectiveDate: '1 Jan 2027', effectiveFrom: '2027-01-01', lastChecked: 'Nov 2025', officialSourceName: 'GOV.UK / HMRC', officialSourceUrl: 'https://www.gov.uk' },
  { id: 'eu-cbam', title: 'EU Carbon Border Adjustment Mechanism (EU CBAM)', jurisdiction: 'European Union', category: 'Sustainability', summary: 'Definitive regime applies to selected carbon-intensive goods. Importers must report embedded emissions and may need to purchase CBAM certificates.', status: 'In Force', effectiveDate: '1 Jan 2026', effectiveFrom: '2026-01-01', lastChecked: 'Nov 2025', officialSourceName: 'European Commission', officialSourceUrl: 'https://environment.ec.europa.eu' },
  { id: 'uk-safety', title: 'UK Product Safety & Labelling Requirements', jurisdiction: 'United Kingdom', category: 'Market Access', summary: 'Review applicable product standards, labelling, and conformity obligations before market entry.', status: 'In Force', effectiveDate: 'In force', effectiveFrom: '2021-01-01', lastChecked: 'Oct 2025', officialSourceName: 'UK Government', officialSourceUrl: 'https://www.gov.uk' },
  { id: 'uk-control', title: 'UK Strategic Export Control Lists', jurisdiction: 'United Kingdom', category: 'Export Control', summary: 'Check whether controlled goods, software, or technology require licensing or end-use review.', status: 'In Force', effectiveDate: 'In force', effectiveFrom: '2021-01-01', lastChecked: 'Sep 2025', officialSourceName: 'UK Export Control Joint Unit', officialSourceUrl: 'https://www.gov.uk' },
  { id: 'sanctions', title: 'Sanctions Screening Guidance', jurisdiction: 'Global / UK', category: 'Sanctions & Restricted Parties', summary: 'Verify whether buyers, intermediaries, and end users are subject to sanctions or restricted-party controls.', status: 'In Force', effectiveDate: 'In force', effectiveFrom: '2022-01-01', lastChecked: 'Sep 2025', officialSourceName: 'Office of Financial Sanctions Implementation', officialSourceUrl: 'https://www.gov.uk' },
];

export async function searchRegulations(query: string, filters: { destination?: string; category?: string; status?: string } = {}): Promise<Regulation[]> {
  const normalized = query.toLowerCase().trim();
  return regulations.filter((regulation) => {
    const searchable = `${regulation.title} ${regulation.jurisdiction} ${regulation.category} ${regulation.summary}`.toLowerCase();
    return (!normalized || searchable.includes(normalized))
      && (!filters.destination || filters.destination === 'All markets' || regulation.jurisdiction.includes(filters.destination))
      && (!filters.category || filters.category === 'All topics' || regulation.category === filters.category)
      && (!filters.status || filters.status === 'All statuses' || regulation.status === filters.status);
  });
}
