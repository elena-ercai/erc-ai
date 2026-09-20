/**
 * Official HS Code lookup sources, keyed by export country.
 * Each entry is a verified official government source — no AI-generated URLs.
 *
 * Only countries with a manually verified official source are listed here.
 * Countries not in this map will show a "no verified source" message.
 */
export interface HsCodeSource {
  label: string;
  url: string;
  /** Short note shown to the user about this source. */
  note?: string;
}

export const hsCodeSources: Record<string, HsCodeSource[]> = {
  Taiwan: [
    {
      label: '臺灣關務署貨品歸屬稅則查詢系統',
      url: 'https://hscode.customs.gov.tw/',
      note: 'Taiwan Customs Administration — official HS code classification lookup.',
    },
    {
      label: '國際貿易署「如何查詢 HS CODE」',
      url: 'https://www.trade.gov.tw/Pages/Detail.aspx?nodeid=5146&pid=817004',
      note: 'International Trade Administration — guide on how to look up HS codes.',
    },
  ],
};

/**
 * Returns the verified HS code lookup sources for the given export country.
 * Returns an empty array if no verified source is configured.
 */
export function getHsCodeSources(exportCountry: string): HsCodeSource[] {
  return hsCodeSources[exportCountry] ?? [];
}
