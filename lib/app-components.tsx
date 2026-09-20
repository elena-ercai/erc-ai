'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { regulations, searchRegulations } from '@/services/regulations';
import { riskLabels, effectiveDateStatusLabels, coverageLabels, priorityJurisdictions, allCountries, getCoverageStatus } from '@/services/risk-engine';
import { EvidenceItem, CoverageStatus, EffectiveDateStatus, Regulation, RiskFinding, RiskReport, Shipment } from './models';
import { AlertTriangle, ArrowRight, BarChart3, BookOpen, Box, CheckCircle2, ChevronDown, ChevronLeft, ClipboardList, Clock3, Copy, Download, ExternalLink, FileCheck2, FileText, Globe2, Home as HomeIcon, Info, Leaf, ListChecks, MapPin, Menu, MessageSquareText, Search, Settings, ShieldCheck, Sparkles, UploadCloud, Users, X, Zap } from 'lucide-react';

export const checks = [
  ['Product & Classification', 'HS code, product characteristics, controlled or regulated goods', ShieldCheck],
  ['Buyer / Entity Risk', 'Sanctions, restricted parties, company risk', Users],
  ['Export Control', 'Export licence, dual-use, end-use', FileText],
  ['Import & Market Access', 'Import restrictions, product standards, certification, labelling', Box],
  ['Tariff & Trade Remedy', 'Tariff, FTA, rules of origin, anti-dumping, countervailing duty', BarChart3],
  ['ESG / Sustainability', 'CBAM, carbon pricing, EUDR, environmental regulations', Leaf],
  ['Forced Labour / Due Diligence', 'Supply-chain traceability and human-rights risks', Users],
] as const;

export const navItems = [
  ['Home', '/', HomeIcon],
  ['New Check', '/check/new?new=1', Zap],
  ['My Checks', '/checks', ClipboardList],
  ['Regulations', '/regulations', BookOpen],
  ['Resources', '/resources', Globe2],
  ['Settings', '/settings', Settings],
] as const;

export function cx(...classes: Array<string | false | undefined>) { return classes.filter(Boolean).join(' '); }

export function StatusBadge({ level }: { level: string }) {
  const label = riskLabels[level as keyof typeof riskLabels] || level;
  return (
    <span className={cx('status-badge', level === 'LOW' ? 'status-low' : level === 'HIGH' ? 'status-high' : 'status-review')}>
      <span className="status-dot" />{label}
    </span>
  );
}

export function EffectiveDateBadge({ status }: { status: EffectiveDateStatus }) {
  const label = effectiveDateStatusLabels[status];
  const tone = status === 'ACTIVE' ? 'ed-active' : status === 'NOT_YET_EFFECTIVE' ? 'ed-upcoming' : status === 'TRANSITIONAL' ? 'ed-transitional' : 'ed-expired';
  return <span className={cx('ed-badge', tone)}><span className="ed-dot" />{label}</span>;
}

export function CoverageBadge({ status }: { status: CoverageStatus }) {
  const label = coverageLabels[status];
  const tone = status === 'PRIORITY_COVERAGE' ? 'cov-priority' : status === 'LIMITED_COVERAGE' ? 'cov-limited' : 'cov-insufficient';
  return <span className={cx('coverage-badge', tone)}><MapPin size={13} />{label}</span>;
}

function getGlobalJurisdiction(): string {
  if (typeof window === 'undefined') return 'Taiwan';
  return localStorage.getItem('erc-jurisdiction') || 'Taiwan';
}

function setGlobalJurisdiction(country: string) {
  if (typeof window !== 'undefined') localStorage.setItem('erc-jurisdiction', country);
}

const isoCodes: Record<string, string> = {
  'Taiwan': 'TW', 'United States': 'US', 'United Kingdom': 'GB', 'Singapore': 'SG',
  'Japan': 'JP', 'Canada': 'CA', 'Australia': 'AU', 'South Korea': 'KR',
  'Argentina': 'AR', 'Bangladesh': 'BD', 'Brazil': 'BR', 'Cambodia': 'KH', 'Chile': 'CL',
  'China': 'CN', 'Colombia': 'CO', 'Costa Rica': 'CR', 'Ecuador': 'EC', 'Egypt': 'EG',
  'European Union': 'EU', 'France': 'FR', 'Germany': 'DE', 'Ghana': 'GH', 'Greece': 'GR',
  'Hong Kong': 'HK', 'India': 'IN', 'Indonesia': 'ID', 'Ireland': 'IE', 'Israel': 'IL',
  'Italy': 'IT', 'Kenya': 'KE', 'Kuwait': 'KW', 'Laos': 'LA', 'Malaysia': 'MY', 'Mexico': 'MX',
  'Morocco': 'MA', 'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nigeria': 'NG', 'Norway': 'NO',
  'Pakistan': 'PK', 'Peru': 'PE', 'Philippines': 'PH', 'Poland': 'PL', 'Portugal': 'PT',
  'Qatar': 'QA', 'Russia': 'RU', 'Saudi Arabia': 'SA', 'South Africa': 'ZA', 'Spain': 'ES',
  'Sri Lanka': 'LK', 'Sweden': 'SE', 'Switzerland': 'CH', 'Thailand': 'TH', 'Turkey': 'TR',
  'Ukraine': 'UA', 'United Arab Emirates': 'AE', 'Vietnam': 'VN', 'Zambia': 'ZM',
};

function countryCode(country: string): string {
  return isoCodes[country] || country.slice(0, 2).toUpperCase();
}

function flagEmoji(country: string): string {
  const code = countryCode(country);
  if (code.length !== 2) return '';
  const a = 0x1f1e6 + (code.charCodeAt(0) - 65);
  const b = 0x1f1e6 + (code.charCodeAt(1) - 65);
  return String.fromCodePoint(a, b);
}

export function JurisdictionSelector({ onChange }: { onChange?: (country: string) => void }) {
  const [open, setOpen] = useState(false);
  // Always start with the server-safe default so SSR and initial client render match.
  // After mount, overwrite with whatever is stored in localStorage.
  const [country, setCountry] = useState('Taiwan');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const stored = localStorage.getItem('erc-jurisdiction');
    if (stored && stored !== 'Taiwan') setCountry(stored);
  }, []);
  const select = (c: string) => {
    setCountry(c);
    setGlobalJurisdiction(c);
    setOpen(false);
    setSearch('');
    onChange?.(c);
  };
  const filtered = allCountries.filter((c) => c.toLowerCase().includes(search.toLowerCase()));
  const isPriority = (c: string) => priorityJurisdictions.includes(c);
  return (
    <div className="jur-selector">
      <button className="jur-trigger" title="Export Jurisdiction" onClick={() => setOpen(!open)}>
        <MapPin size={14} className="jur-pin" />
        <span className="jur-flag-emoji">{flagEmoji(country)}</span>
        <span className="jur-label">Exporting from: {country}</span>
        <span className="jur-label-mobile">{countryCode(country)}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="jur-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="jur-search">
            <Search size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search countries & territories..." autoFocus />
          </div>
          <div className="jur-group-label">Priority Coverage</div>
          {priorityJurisdictions.filter((c) => c.toLowerCase().includes(search.toLowerCase())).map((c) => (
            <button className={cx('jur-option', country === c && 'jur-active')} key={c} onClick={() => select(c)}>
              <span className="jur-opt-emoji">{flagEmoji(c)}</span>{c}
              {country === c && <CheckCircle2 size={14} />}
            </button>
          ))}
          <div className="jur-group-label">All Countries & Territories</div>
          {filtered.filter((c) => !isPriority(c)).map((c) => (
            <button className={cx('jur-option', country === c && 'jur-active')} key={c} onClick={() => select(c)}>
              <span className="jur-opt-emoji">{flagEmoji(c)}</span>{c}
              {country === c && <CheckCircle2 size={14} />}
            </button>
          ))}
          {!filtered.length && <div className="jur-empty">No matching countries</div>}
        </div>
      )}
    </div>
  );
}

export function CountrySelect({ label, required, value, onChange }: { label: string; required?: boolean; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = allCountries.filter((c) => c.toLowerCase().includes(search.toLowerCase()));
  const isPriority = (c: string) => priorityJurisdictions.includes(c);
  return (
    <label className="field">
      <span>{label}{required && <b>*</b>}</span>
      <div className="country-select">
        <button type="button" className="country-trigger" onClick={() => setOpen(!open)}>
          {value || 'Select country or territory...'}<ChevronDown size={14} />
        </button>
        {open && (
          <div className="country-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="jur-search">
              <Search size={14} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search countries & territories..." autoFocus />
            </div>
            <div className="jur-group-label">Priority Coverage</div>
            {priorityJurisdictions.filter((c) => c.toLowerCase().includes(search.toLowerCase())).map((c) => (
              <button type="button" className={cx('jur-option', value === c && 'jur-active')} key={c} onClick={() => { onChange(c); setOpen(false); setSearch(''); }}>
                {c}{value === c && <CheckCircle2 size={14} />}
              </button>
            ))}
            <div className="jur-group-label">All Countries & Territories</div>
            {filtered.filter((c) => !isPriority(c)).map((c) => (
              <button type="button" className={cx('jur-option', value === c && 'jur-active')} key={c} onClick={() => { onChange(c); setOpen(false); setSearch(''); }}>
                {c}{value === c && <CheckCircle2 size={14} />}
              </button>
            ))}
            {!filtered.length && <div className="jur-empty">No matching countries</div>}
            <button type="button" className="jur-custom" onClick={() => { onChange(search); setOpen(false); setSearch(''); }}>
              Use &ldquo;{search}&rdquo; as custom country
            </button>
          </div>
        )}
      </div>
    </label>
  );
}

export function AppShell({ children, active = '/' }: { children: React.ReactNode; active?: string }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [jurKey, setJurKey] = useState(0);
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasDraft(!!localStorage.getItem('erc-shipment'));
    }
  }, []);
  return (
    <div className="app-frame" onClick={() => { /* close dropdowns on outside click */ }}>
      <header className="top-nav">
        <button className="brand" onClick={() => router.push('/')}>
          <span className="brand-mark"><Globe2 size={22} /></span>
          <span><strong>ERC AI</strong><small>Export Risk Check AI</small></span>
        </button>
        <nav className="top-links">
          <button onClick={() => router.push('/')}>Home</button>
          <button onClick={() => router.push('/checks')}>Checks</button>
          <button onClick={() => router.push('/regulations')}>Knowledge</button>
          <button onClick={() => router.push('/resources')}>Help</button>
        </nav>
        <JurisdictionSelector key={jurKey} onChange={() => { setJurKey((k) => k + 1); if (typeof window !== 'undefined') { localStorage.removeItem('erc-report'); localStorage.removeItem('erc-report-id'); } }} />
        <button className="mobile-menu" onClick={() => setMenu(!menu)}><Menu size={20} /></button>
      </header>
      {menu && (
        <div className="mobile-nav">
          {navItems.map(([label, href]) => (
            <button key={href} onClick={() => { router.push(href); setMenu(false); }}>{label}</button>
          ))}
        </div>
      )}
      <div className="shell-body">
        <aside className="sidebar">
          {navItems.map(([label, href, Icon]) => (
            <button key={href} className={cx('side-item', active === href && 'side-active')} onClick={() => router.push(href)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
          {hasDraft && (
            <button className="side-item side-item-draft" onClick={() => router.push('/check/new')}>
              <ChevronLeft size={18} /><span>Continue Draft</span>
            </button>
          )}
          <div className="sidebar-note"><Globe2 size={58} /><strong>Safer trade.<br />A brighter tomorrow.</strong><i /></div>
        </aside>
        <main className="main-content">{children}</main>
      </div>
      <footer className="footer">
        <span>ERC AI &nbsp;|&nbsp; Export Risk Check AI &nbsp;|&nbsp; Check export risks before you trade.</span>
        <span className="footer-disclaimer">ERC AI provides risk-assessment and regulatory guidance only. It does not constitute legal advice, customs clearance, export authorization, or an official government determination.</span>
      </footer>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stepper({ step }: { step: number }) {
  return (
    <div className="stepper">
      {['Input', 'Review', 'Results'].map((label, index) => (
        <div className={cx('step', index + 1 <= step && 'step-done')} key={label}>
          <span>{index + 1}</span><strong>{label}</strong>{index < 2 && <i />}
        </div>
      ))}
    </div>
  );
}

export function SectionTitle({ number, title }: { number: string; title: string }) {
  return <h2 className="section-title"><span>{number}.</span> {title}</h2>;
}

export function Field({ label, required, value, onChange, placeholder, multiline, className }: { label: string; required?: boolean; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; className?: string }) {
  return (
    <label className={cx('field', className)}>
      <span>{label}{required && <b>*</b>}</span>
      {multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} /> : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}
    </label>
  );
}

export function PrimaryButton({ children, onClick, type = 'button', icon = true }: { children: React.ReactNode; onClick?: () => void; type?: 'button' | 'submit'; icon?: boolean }) {
  return <button type={type} className="primary-button" onClick={onClick}>{children}{icon && <ArrowRight size={17} />}</button>;
}

export function getDemoShipment(): Shipment {
  const jurisdiction = getGlobalJurisdiction();
  return {
    productName: 'Aluminum profiles', hsCode: '7604.10', productCategory: 'Aluminum & Metals',
    productCharacteristics: 'Aluminum extrusions, non-alloy, for construction use',
    exportingCountry: jurisdiction, destinationCountry: 'United Kingdom', countryOfOrigin: jurisdiction, buyerImporter: 'UK Building Solutions Ltd.',
    plannedImportDate: '2027-01-15',
    endUse: 'Building and construction use',
    supplyChainInformation: `Primary aluminum from ${jurisdiction} suppliers`, certificates: 'Mill Certificate, Certificate of Origin',
  };
}

export const demoShipment: Shipment = {
  productName: 'Aluminum profiles', hsCode: '7604.10', productCategory: 'Aluminum & Metals',
  productCharacteristics: 'Aluminum extrusions, non-alloy, for construction use',
  exportingCountry: 'Taiwan', destinationCountry: 'United Kingdom', countryOfOrigin: 'Taiwan', buyerImporter: 'UK Building Solutions Ltd.',
  plannedImportDate: '2027-01-15',
  endUse: 'Building and construction use',
  supplyChainInformation: 'Primary aluminum from Taiwan suppliers', certificates: 'Mill Certificate, Certificate of Origin',
};

export function Dashboard() {
  const router = useRouter();
  const rows = [
    ['Nov 28, 2025', 'Aluminum products', 'United Kingdom', 'ABC Ltd.', 'REVIEW'],
    ['Nov 25, 2025', 'Machine parts', 'United States', 'XYZ Inc.', 'LOW'],
    ['Nov 20, 2025', 'Plastic products', 'European Union', 'Europa GmbH', 'REVIEW'],
    ['Nov 15, 2025', 'Electronic components', 'United States', 'Global Tech', 'HIGH'],
    ['Nov 10, 2025', 'Steel products', 'European Union', 'EU Buyer', 'LOW'],
  ];
  return (
    <AppShell active="/">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">GLOBAL COMPLIANCE &nbsp;•&nbsp; SMARTER TRADE &nbsp;•&nbsp; BRIGHTER TOMORROW</div>
          <h1>ERC AI</h1>
          <div className="hero-subtitle">Export Risk Check AI</div>
          <h2>Check export risks before you trade.</h2>
          <p>AI-powered export risk advice to help you decide<br />whether to enter a market or trade.</p>
          <div className="zh">交易前，風險檢查。</div>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <Globe2 size={160} />
          <div className="ship-shape"><span /><span /><span /></div>
          <div className="hero-words">COMPLIANCE<br />ENABLES<br />A BRIGHTER<br />TOMORROW<i /></div>
        </div>
        <div className="feature-grid">
          {[['Regulatory Risk Check', ShieldCheck, 'blue'], ['Obligations & Requirements', FileText, 'green'], ['Exemptions & Opportunities', BarChart3, 'violet'], ['Evidence & Next Steps', FileCheck2, 'amber']].map(([label, Icon, tone]) => (
            <div className="feature-card" key={label as string}><span className={cx('feature-icon', `tone-${tone}`)}><Icon size={20} /></span><strong>{label as string}</strong></div>
          ))}
        </div>
        <PrimaryButton onClick={() => router.push('/check/new?new=1')}>New Export Risk Check</PrimaryButton>
      </section>
      <section className="confidence-banner">
        <div><h2>Navigate global trade<br />with confidence.</h2><p>Turn complex regulations into clear actions<br />with the power of AI.</p></div>
        <div className="banner-lines" />
      </section>
      <section className="content-card">
        <div className="card-heading"><h2>Recent Checks</h2><button onClick={() => router.push('/checks')}>View All <ArrowRight size={15} /></button></div>
        <div className="table-wrap">
          <table><thead><tr><th>Date</th><th>Product</th><th>Destination</th><th>Buyer / Importer</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row[0]}>{row.slice(0, 4).map((cell) => <td key={cell}>{cell}</td>)}<td><StatusBadge level={row[4]} /></td></tr>)}
          </tbody>
        </table>
        </div>
      </section>
      <section className="quote-banner">
        <span>“</span>
        <div><h2>Less uncertainty. More global opportunities.</h2><p>讓合規更簡單，讓世界更近。</p></div>
        <div className="quote-art" />
      </section>
    </AppShell>
  );
}

function blankShipment(): Shipment {
  const jurisdiction = getGlobalJurisdiction();
  return {
    productName: '', hsCode: '', productCategory: '', productCharacteristics: '',
    exportingCountry: jurisdiction, destinationCountry: '', countryOfOrigin: '', buyerImporter: '',
    plannedImportDate: '', endUse: '',
    supplyChainInformation: '', certificates: '',
  };
}

export function Intake() {
  const router = useRouter();
  const [shipment, setShipment] = useState<Shipment>(() => blankShipment());
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.removeItem('erc-shipment');
  }, []);
  const [error, setError] = useState('');
  const update = (key: keyof Shipment) => (value: string) => setShipment((current) => ({ ...current, [key]: value }));
  const run = () => {
    if (!shipment.productName || !shipment.exportingCountry || !shipment.destinationCountry || !shipment.buyerImporter || !shipment.plannedImportDate) {
      setError('Please complete all required fields (including Planned Import Date) before continuing.');
      return;
    }
    localStorage.setItem('erc-shipment', JSON.stringify(shipment));
    router.push('/check/review');
  };
  return (
    <AppShell active="/check/new">
      <PageHeader title="Shipment Intake" subtitle="Tell us about your shipment. We'll check applicable regulations, risks, and possible reliefs for your target market." action={<Stepper step={1} />} />
      <div className="intake-layout">
        <form className="content-card intake-form" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <SectionTitle number="1" title="Product Information" />
          <Field label="Product name / description" required value={shipment.productName} onChange={update('productName')} />
          <div className="field-row">
            <Field label="HS Code" value={shipment.hsCode} onChange={update('hsCode')} />
            <button type="button" className="text-button"><Search size={14} /> Search HS Code</button>
            <Field label="Product category" value={shipment.productCategory} onChange={update('productCategory')} />
          </div>
          <Field label="Key product characteristics" multiline value={shipment.productCharacteristics} onChange={update('productCharacteristics')} />
          <SectionTitle number="2" title="Trade Information" />
          <div className="field-row two">
            <CountrySelect label="Exporting country" required value={shipment.exportingCountry} onChange={update('exportingCountry')} />
            <CountrySelect label="Destination country" required value={shipment.destinationCountry} onChange={update('destinationCountry')} />
            <label className="field">
              <span>Planned Import / Entry Date<b>*</b></span>
              <input type="date" value={shipment.plannedImportDate} onChange={(event) => update('plannedImportDate')(event.target.value)} />
              <small className="field-help">Enter the expected date the goods will enter the destination market. ERC AI uses this date to determine whether a regulation is active, upcoming, transitional, or no longer applicable.</small>
            </label>
            <Field label="Buyer / Importer" required value={shipment.buyerImporter} onChange={update('buyerImporter')} />
            <Field label="End use" multiline value={shipment.endUse} onChange={update('endUse')} />
            <Field label="Supply-chain information" multiline value={shipment.supplyChainInformation} onChange={update('supplyChainInformation')} />
          </div>
          <Field label="Known certificates / documents" value={shipment.certificates} onChange={update('certificates')} />
          <SectionTitle number="3" title="Supporting Documents" />
          <div className="upload-box"><UploadCloud size={30} /><strong>Drag and drop files here, or click to upload</strong><small>PDF, JPG, PNG (Max 10 MB each)</small></div>
          {error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={() => { setShipment(blankShipment()); setError(''); }}>Clear</button>
            <PrimaryButton type="submit">Run Export Risk Check</PrimaryButton>
          </div>
        </form>
        <aside className="checks-panel content-card">
          <h2>Regulatory checks to run</h2>
          <p>ERC AI will automatically identify applicable regulations for your product and destination.</p>
          {checks.map(([title, copy, Icon]) => (
            <div className="check-row" key={title}>
              <span className="check-icon"><Icon size={18} /></span>
              <div><strong>{title}</strong><small>{copy}</small></div>
              <CheckCircle2 size={18} className="check-mark" />
            </div>
          ))}
        </aside>
      </div>
    </AppShell>
  );
}

export function Review() {
  const router = useRouter();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [processing, setProcessing] = useState(false);
  const [hsConfirmed, setHsConfirmed] = useState<{ product: string; code: string; country: string } | null>(null);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    try { setShipment(JSON.parse(localStorage.getItem('erc-shipment') || 'null')); } catch { setShipment(null); }
    try { setHsConfirmed(JSON.parse(localStorage.getItem('erc-hs-confirmed') || 'null')); } catch { setHsConfirmed(null); }
  }, []);
  if (!shipment) return (
    <AppShell active="/check/new">
      <div className="empty-state"><AlertTriangle size={30} /><h2>No shipment found</h2><p>Start a new check to review shipment details.</p><PrimaryButton onClick={() => router.push('/check/new?new=1')}>Start New Check</PrimaryButton></div>
    </AppShell>
  );
  const formatDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not provided';
  const fields = [
    ['Product', shipment.productName], ['HS Code', shipment.hsCode || 'Not provided'],
    ['Exporting Country', shipment.exportingCountry], ['Country of Origin', shipment.countryOfOrigin || 'Not provided'],
    ['Destination', shipment.destinationCountry],
    ['Planned Import / Entry Date', formatDate(shipment.plannedImportDate)],
    ['Buyer / Importer', shipment.buyerImporter || 'Not provided'], ['End Use', shipment.endUse || 'Not provided'],
    ['Supply Chain', shipment.supplyChainInformation || 'Not provided'],
    ['Certificates', shipment.certificates || 'Not provided'],
  ];
  const exportCov = getCoverageStatus(shipment.exportingCountry);
  const destCov = getCoverageStatus(shipment.destinationCountry);
  const hsNeedsConfirm = shipment &&
    !!shipment.hsCode &&
    !!shipment.exportingCountry &&
    !!shipment.productName &&
    (hsConfirmed?.product !== shipment.productName ||
     hsConfirmed?.code !== shipment.hsCode ||
     hsConfirmed?.country !== shipment.exportingCountry);

  const confirmHsOnReview = () => {
    if (!shipment) return;
    const triple = { product: shipment.productName, code: shipment.hsCode, country: shipment.exportingCountry };
    setHsConfirmed(triple);
    localStorage.setItem('erc-hs-confirmed', JSON.stringify(triple));
    setReviewError('');
  };

  const confirm = async () => {
    if (hsNeedsConfirm) {
      setReviewError('Please confirm the HS Code is valid for the selected export country before running the check.');
      return;
    }
    setReviewError('');
    setProcessing(true);
    const response = await fetch('/api/analyze-shipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipment }),
    });
    if (!response.ok) {
      setProcessing(false);
      return;
    }
    const report = await response.json();
    localStorage.setItem('erc-report', JSON.stringify(report));
    localStorage.setItem('erc-report-id', report.id);
    router.push(`/check/results/${report.id}`);
  };
  return (
    <AppShell active="/check/new">
      <PageHeader title="Review Your Shipment" subtitle="Please confirm the final English form below. This is the data that will be sent to the risk check." action={<Stepper step={2} />} />
      {processing ? (
        <div className="processing-card content-card">
          <div className="processing-icon"><Sparkles size={28} /></div>
          <h2>Checking your shipment...</h2>
          <p>Using demo risk assessment data for this Day 1 build.</p>
          <div className="processing-list">
            {['Validating shipment information', 'Checking applicable regulations', 'Reviewing export-control considerations', 'Evaluating market-access requirements', 'Preparing risk advisory report'].map((item, index) => (
              <div key={item} className="processing-step" style={{ animationDelay: `${index * 0.25}s` }}><CheckCircle2 size={17} />{item}</div>
            ))}
          </div>
        </div>
      ) : (
        <div className="review-card content-card">
          <div className="review-label"><ClipboardList size={18} /> Shipment details</div>
          <div className="coverage-row">
            <div><small>Export-side coverage</small><CoverageBadge status={exportCov} /></div>
            <div><small>Destination coverage</small><CoverageBadge status={destCov} /></div>
          </div>
          <div className="review-grid">
            {fields.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
          </div>
          {!shipment.buyerImporter && (
            <div className="disclaimer ercie-buyer-notice"><Info size={17} /><span>未提供買主資料，本次未執行買主風險檢查。Buyer risk screening was not performed. Other checks still run.</span></div>
          )}
          {hsNeedsConfirm && (
            <div className="hs-confirm-banner">
              <AlertTriangle size={14} />
              <span>You are using HS <strong>{shipment.hsCode}</strong> for this shipment (export country: <strong>{shipment.exportingCountry}</strong>). Please confirm this is the code you intend to use.</span>
              <button type="button" className="hs-confirm-btn" onClick={confirmHsOnReview}>
                I confirm HS {shipment.hsCode} for this shipment (export country: {shipment.exportingCountry})
              </button>
            </div>
          )}
          <div className="disclaimer"><Info size={17} /><span>本報告依據您確認提供的資料產生。This report is generated based on data you confirmed. ERC AI does not provide official approval, clearance, or verify data authenticity.</span></div>
          {reviewError && <div className="form-error"><AlertTriangle size={16} />{reviewError}</div>}
          <div className="form-actions">
            <button className="secondary-button" onClick={() => router.push('/check/new')}><ChevronLeft size={16} /> Edit Form</button>
            <PrimaryButton onClick={confirm}>Start Risk Check</PrimaryButton>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export function Report({ id }: { id: string }) {
  const router = useRouter();
  const [report, setReport] = useState<RiskReport | null>(null);
  const [tab, setTab] = useState('Executive Summary');
  const [modal, setModal] = useState(false);
  useEffect(() => {
    try { setReport(JSON.parse(localStorage.getItem('erc-report') || 'null')); } catch { setReport(null); }
  }, []);
  if (!report) return (
    <AppShell active="/checks">
      <div className="empty-state"><AlertTriangle size={30} /><h2>Report not found</h2><PrimaryButton onClick={() => router.push('/check/new?new=1')}>Start New Check</PrimaryButton></div>
    </AppShell>
  );
  const tabs = ['Executive Summary', 'Detail by Regulation', 'Evidence Checklist', 'Sources', 'Confirmed Form'];
  const copyUrl = () => {
    if (typeof navigator !== 'undefined') { navigator.clipboard?.writeText(window.location.href); alert('Report link copied to clipboard.'); }
  };
  const viewSources = () => setTab('Sources');
  return (
    <AppShell active="/checks">
      <div className="report-top">
        <PageHeader title="Pre-Export Risk Advisory Report" eyebrow="GLOBAL COMPLIANCE  •  SMARTER TRADE  •  BRIGHTER TOMORROW" />
        <div className="report-meta">
          <span>Report ID: {report.id}</span>
          <span>Generated: {new Date(report.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span className="prototype-badge">PROTOTYPE — MOCK REGULATORY DATA</span>
          <div>
            <button className="outline-button" onClick={() => alert('PDF generation will be enabled in a later build.')}><Download size={15} /> Download PDF</button>
            <button className="outline-button" onClick={copyUrl}><Copy size={15} /> Share</button>
          </div>
        </div>
      </div>
      <div className="shipment-strip content-card">
        <div className="product-art"><Box size={42} /></div>
        <div>
          <h3>{report.shipment.productName}</h3>
          <p>HS Code: {report.shipment.hsCode || 'Not provided'}</p>
          <p>Exporting from: {report.shipment.exportingCountry} → Destination: {report.shipment.destinationCountry}</p>
          <p>Country of Origin: {report.shipment.countryOfOrigin || 'Not provided'}</p>
          <p>Planned Import Date: {report.shipment.plannedImportDate ? new Date(report.shipment.plannedImportDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not provided'}</p>
          <p>Buyer: {report.shipment.buyerImporter || 'Not provided — buyer risk screening not performed'}</p>
          <div className="report-coverage">
            <div><small>Export-side coverage</small>{report.exportCoverage && <CoverageBadge status={report.exportCoverage} />}</div>
            <div><small>Destination coverage</small>{report.destinationCoverage && <CoverageBadge status={report.destinationCoverage} />}</div>
          </div>
        </div>
        <button className="outline-button" onClick={() => router.push('/check/new')}><FileText size={15} /> Edit Input</button>
      </div>
      <div className="report-tabs">
        {tabs.map((item) => <button className={tab === item ? 'tab-active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      {tab === 'Executive Summary' && (
        <>
          <section className="ercie-report-disclaimer content-card">
            <Info size={18} />
            <div>
              <strong>本報告依據您確認提供的資料產生。</strong>
              <p>This report is generated based on data you confirmed. ERC AI does not provide official approval, clearance, or verify data authenticity.</p>
            </div>
          </section>
          {!report.shipment.buyerImporter && (
            <section className="ercie-report-disclaimer content-card ercie-buyer-notice">
              <AlertTriangle size={18} />
              <div>
                <strong>未提供買主資料，本次未執行買主風險檢查。</strong>
                <p>No buyer information was provided. Buyer / entity risk screening was not performed in this check. Other regulatory checks were still conducted.</p>
              </div>
            </section>
          )}
          <section className="assessment">
            <div className="assessment-symbol"><AlertTriangle size={28} /></div>
            <div>
              <small>Overall Assessment</small>
              <h2>{report.assessmentTitle}</h2>
              <p>{report.assessmentSummary}</p>
            </div>
            <div className="risk-counts">
              <span><i className="dot-green" /> Low Risk <b>{report.summaryLow ?? 0}</b></span>
              <span><i className="dot-amber" /> Review Recommended <b>{report.summaryReview ?? 0}</b></span>
              <span><i className="dot-red" /> High Risk <b>{report.summaryHigh ?? 0}</b></span>
            </div>
          </section>
          <section className="summary-cards">
            <div className="summary-card">
              <span className="feature-icon tone-blue"><ShieldCheck size={18} /></span>
              <strong>Regulatory Risk</strong>
              <h3>{report.regulatoryRiskLabel || 'Not identified'}</h3>
              {report.regulatoryRiskStatus && <div className="summary-ed-badge"><EffectiveDateBadge status={report.regulatoryRiskStatus} /></div>}
            </div>
            {[['Importer Obligation', FileText, `${report.shipment.destinationCountry} importer`, 'Primary legal obligation lies with the importer in the destination market.'], ['Relief Opportunity', BarChart3, 'Potential relief', report.reliefText || 'Recognised carbon pricing evidence may reduce exposure.'], ['Evidence Status', FileCheck2, 'Incomplete', 'Additional evidence is required to support the assessment.']].map(([title, Icon, value, copy]) => (
              <div className="summary-card" key={title as string}>
                <span className="feature-icon tone-blue"><Icon size={18} /></span>
                <strong>{title as string}</strong>
                <h3>{value as string}</h3>
                <p>{copy as string}</p>
              </div>
            ))}
          </section>
          {report.findings.some((f) => f.effectiveDateStatus) && (
            <section className="effective-date-card content-card">
              <div className="section-heading"><Clock3 size={19} /><h3>Effective Date Check</h3></div>
              <div className="ed-grid">
                {report.findings.filter((f) => f.effectiveFrom).map((f) => (
                  <div className="ed-row" key={f.id}>
                    <div><small>Regulation</small><strong>{f.title}</strong></div>
                    <div><small>Regulation Effective Date</small><strong>{f.effectiveFrom ? new Date(f.effectiveFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</strong></div>
                    <div><small>Planned Import Date</small><strong>{f.shipmentDate ? new Date(f.shipmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</strong></div>
                    <div><small>Status</small>{f.effectiveDateStatus && <EffectiveDateBadge status={f.effectiveDateStatus} />}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="relief-card">
            <span className="feature-icon tone-green"><Leaf size={20} /></span>
            <div><h3>Potential Relief / Opportunity</h3><p>{report.reliefText || 'Recognised carbon pricing evidence may support a qualifying relief pathway. With proper evidence, potential liability may be reduced.'}</p></div>
            <button className="outline-button">Learn More <ArrowRight size={15} /></button>
          </section>
          <div className="report-columns">
            <section className="report-section">
              <div className="section-heading"><AlertTriangle size={19} /><h3>Missing Evidence</h3></div>
              {report.evidence.length === 0 ? (
                <p className="source-empty">{report.overallRisk === 'INSUFFICIENT_EVIDENCE' ? 'Evidence requirements could not be fully determined. Human review is recommended.' : 'No specific evidence requirements have been identified from the current analysis.'}</p>
              ) : (
                report.evidence.map((item: EvidenceItem) => <label className="evidence-row" key={item.id}><span className="checkbox" />{item.title}<small>{item.status}</small></label>)
              )}
            </section>
            <section className="report-section" id="next-actions">
              <div className="section-heading"><ListChecks size={19} /><h3>Next Actions</h3></div>
              {report.nextActions.map((action: string, index: number) => <div className="action-row" key={action}><span>{index + 1}</span>{action}</div>)}
            </section>
          </div>
          <section className="source-highlight">
            <FileText size={19} />
            <div><strong>Official Sources</strong><p>Review the source material behind this advisory and keep records for your compliance file.</p></div>
            <button onClick={viewSources}>View Sources <ExternalLink size={14} /></button>
          </section>
          <div className="report-actions">
            <PrimaryButton onClick={() => setModal(true)}><MessageSquareText size={16} /> Explain My Risk</PrimaryButton>
            <button
              className="secondary-button"
              disabled={report.nextActions.length === 0}
              aria-disabled={report.nextActions.length === 0}
              title={report.nextActions.length === 0 ? 'No specific next actions have been identified from the current analysis.' : undefined}
              onClick={() => {
                const el = document.getElementById('next-actions');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                  el.setAttribute('tabindex', '-1');
                  el.focus();
                  el.classList.add('highlight-flash');
                  setTimeout(() => el.classList.remove('highlight-flash'), 1600);
                }
              }}
            ><ListChecks size={16} /> Show Next Steps</button>
            <button className="secondary-button" onClick={viewSources}><ExternalLink size={16} /> View Sources</button>
          </div>
        </>
      )}
      {tab === 'Detail by Regulation' && <DetailTab findings={report.findings} sources={report.sources} />}
      {tab === 'Evidence Checklist' && <EvidenceTab evidence={report.evidence} isInsufficientEvidence={report.overallRisk === 'INSUFFICIENT_EVIDENCE'} />}
      {tab === 'Sources' && <SourcesTab sources={report.sources} />}
      {tab === 'Confirmed Form' && <ConfirmedFormTab shipment={report.shipment} />}
      {modal && <Modal onClose={() => setModal(false)} />}
    </AppShell>
  );
}

function DetailTab({ findings, sources }: { findings: RiskFinding[]; sources: RiskReport['sources'] }) {
  return (
    <section className="detail-list">
      {findings.map((finding) => {
        const findingSources = (finding.sourceIds || []).map((id) => sources.find((s) => s.id === id)).filter(Boolean) as RiskReport['sources'];
        return (
        <article className="finding-card" key={finding.id}>
          <div className="finding-top">
            <div><span className="eyebrow">{finding.category}</span><h2>{finding.title}</h2></div>
            <StatusBadge level={finding.riskLevel} />
          </div>
          {finding.jurisdiction && <div className="detail-meta"><small>Jurisdiction</small><strong>{finding.jurisdiction}</strong></div>}
          {finding.hsCode && <div className="detail-meta"><small>HS Code</small><strong>{finding.hsCode}</strong></div>}
          {finding.effectiveFrom && (
            <div className="ed-detail-block">
              <div className="detail-meta"><small>Effective From</small><strong>{new Date(finding.effectiveFrom).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></div>
              {finding.shipmentDate && <div className="detail-meta"><small>Planned Import Date</small><strong>{new Date(finding.shipmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></div>}
              {finding.effectiveDateStatus && <div className="detail-meta"><small>Effective Date Status</small><EffectiveDateBadge status={finding.effectiveDateStatus} /></div>}
            </div>
          )}
          <p>{finding.summary}</p>
          <strong>Why this matters</strong>
          <p>{finding.reason}</p>
          {finding.requiredEvidence.length > 0 && (
            <>
              <strong>Evidence Required</strong>
              <ul className="evidence-list">{finding.requiredEvidence.map((ev) => <li key={ev}>{ev}</li>)}</ul>
            </>
          )}
          <strong>Recommended action</strong>
          <p>{finding.recommendedAction}</p>
          {findingSources.length > 0 && (
            <div className="finding-sources">
              <strong>Supporting Sources</strong>
              {findingSources.map((source) => {
                const linkUrl = source.directSourceUrl || source.url;
                return (
                  <div className="finding-source-item" key={source.id}>
                    <span className="feature-icon tone-blue"><FileText size={15} /></span>
                    <div>
                      <strong>{source.title}</strong>
                      {source.legalInstrument && <span className="source-instrument">{source.legalInstrument}</span>}
                      {source.relevantProvision && <small>Relevant provision: {source.relevantProvision}</small>}
                      <small>{source.name}{source.jurisdiction ? ` · ${source.jurisdiction}` : ''}</small>
                      {source.official && <span className="source-official-tag">Official Source</span>}
                    </div>
                    <a href={linkUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
                  </div>
                );
              })}
            </div>
          )}
          {findingSources.length === 0 && (finding.sourceIds || []).length === 0 && (
            <div className="finding-sources">
              <strong>Supporting Sources</strong>
              <p className="source-empty">No specific source matched this finding. Additional regulatory research required.</p>
            </div>
          )}
        </article>
        );
      })}
    </section>
  );
}

const evidenceStatusLabels: Record<string, string> = {
  AVAILABLE: 'Available',
  MISSING: 'Missing',
  RECOMMENDED: 'Recommended',
  NOT_APPLICABLE: 'Not Applicable',
};

function evidenceBadgeLevel(schemaStatus?: string, legacyStatus?: string): string {
  if (schemaStatus === 'MISSING' || legacyStatus === 'Missing') return 'HIGH';
  if (schemaStatus === 'RECOMMENDED' || legacyStatus === 'Recommended') return 'REVIEW';
  if (schemaStatus === 'NOT_APPLICABLE' || legacyStatus === 'Not Applicable') return 'LOW';
  return 'LOW';
}

function EvidenceTab({ evidence, isInsufficientEvidence }: { evidence: EvidenceItem[]; isInsufficientEvidence?: boolean }) {
  return (
    <section className="detail-list">
      <div className="content-card">
        <div className="section-heading"><FileCheck2 size={19} /><h3>Evidence checklist</h3></div>
        {evidence.length === 0 ? (
          <p className="source-empty">{isInsufficientEvidence ? 'Evidence requirements could not be fully determined. Human review is recommended.' : 'No specific evidence requirements have been identified from the current analysis.'}</p>
        ) : (
          evidence.map((item) => (
            <div className="evidence-row large" key={item.id}>
              <span className="checkbox" />
              {item.title}
              <StatusBadge level={evidenceBadgeLevel(item.schemaStatus, item.status)} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SourcesTab({ sources }: { sources: RiskReport['sources'] }) {
  const exportSources = sources.filter((s) => s.side === 'export');
  const destinationSources = sources.filter((s) => s.side === 'destination');
  const granularityLabel: Record<string, string> = {
    LEGAL_PROVISION: 'Legal Provision',
    SPECIFIC_GUIDANCE: 'Specific Guidance',
    GENERAL_AUTHORITY: 'General Authority',
  };
  const granularityClass: Record<string, string> = {
    LEGAL_PROVISION: 'source-granularity-legal',
    SPECIFIC_GUIDANCE: 'source-granularity-guidance',
    GENERAL_AUTHORITY: 'source-granularity-general',
  };
  const renderGroup = (label: string, group: RiskReport['sources']) => (
    <div className="content-card">
      <div className="section-heading"><Globe2 size={19} /><h3>{label}</h3></div>
      {group.length === 0 && <p className="source-empty">Additional regulatory research required.</p>}
      {group.map((source) => {
        const isUnresolved = !source.url;
        const linkUrl = source.directSourceUrl || source.url;
        return (
          <div className="source-row" key={source.id}>
            <span className="feature-icon tone-blue"><Globe2 size={17} /></span>
            <div>
              <strong>{source.title}</strong>
              {source.legalInstrument && <span className="source-instrument">{source.legalInstrument}</span>}
              {source.relevantProvision && <small className="source-provision">Relevant provision: {source.relevantProvision}</small>}
              <small>{source.name}{source.jurisdiction ? ` · ${source.jurisdiction}` : ''}</small>
              {source.official && <span className="source-official-tag">Official Source</span>}
              {source.sourceGranularity && <span className={granularityClass[source.sourceGranularity]}>{granularityLabel[source.sourceGranularity]}</span>}
              {source.sourceGranularity === 'GENERAL_AUTHORITY' && source.official && <small className="source-general-note">General authority source — specific provision not yet retrieved</small>}
              {source.lastVerified && <small className="source-verified">Last verified: {new Date(source.lastVerified).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</small>}
            </div>
            {isUnresolved ? <span className="source-unresolved">Additional research required</span> : <a href={linkUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> View Source</a>}
          </div>
        );
      })}
    </div>
  );
  return (
    <section className="detail-list">
      {renderGroup('Export-side sources', exportSources)}
      {renderGroup('Destination-side sources', destinationSources)}
    </section>
  );
}

function ConfirmedFormTab({ shipment }: { shipment: Shipment }) {
  const formatDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not provided';
  const rows: [string, string][] = [
    ['Product name / description', shipment.productName || 'Not provided'],
    ['HS Code', shipment.hsCode || 'Not provided'],
    ['Export country', shipment.exportingCountry || 'Not provided'],
    ['Country of origin', shipment.countryOfOrigin || 'Not provided'],
    ['Destination country', shipment.destinationCountry || 'Not provided'],
    ['Buyer / Importer', shipment.buyerImporter || 'Not provided — buyer risk screening not performed'],
    ['Planned import date', formatDate(shipment.plannedImportDate)],
    ['Product category', shipment.productCategory || 'Not provided'],
    ['Key product characteristics', shipment.productCharacteristics || 'Not provided'],
    ['End use', shipment.endUse || 'Not provided'],
    ['Supply-chain information', shipment.supplyChainInformation || 'Not provided'],
    ['Known certificates / documents', shipment.certificates || 'Not provided'],
  ];
  return (
    <section className="detail-list">
      <div className="content-card">
        <div className="section-heading"><ClipboardList size={19} /><h3>Confirmed English Form</h3></div>
        <p className="source-empty" style={{ marginBottom: '14px' }}>本表單與實際送檢資料一致。This is the exact data that was sent to the risk check, as confirmed by you.</p>
        <div className="review-grid">
          {rows.map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Modal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <span className="feature-icon tone-blue"><Sparkles size={20} /></span>
        <h2>Explain My Risk</h2>
        <p>This demo assessment highlights areas where more information could change the outcome. The largest open question is whether the product and its embedded emissions evidence fall within the destination market&apos;s sustainability requirements.</p>
        <p>ERC AI has not performed a live regulatory or buyer screening. Use this report as a structured starting point for gathering evidence and speaking with your compliance adviser.</p>
        <button className="primary-button" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export function ChecksPage() {
  const router = useRouter();
  const rows = [
    ['Nov 28, 2025', 'Aluminum products', 'United Kingdom', 'ABC Ltd.', 'REVIEW'],
    ['Nov 25, 2025', 'Machine parts', 'United States', 'XYZ Inc.', 'LOW'],
    ['Nov 20, 2025', 'Plastic products', 'European Union', 'Europa GmbH', 'REVIEW'],
    ['Nov 15, 2025', 'Electronic components', 'United States', 'Global Tech', 'HIGH'],
    ['Nov 10, 2025', 'Steel products', 'European Union', 'EU Buyer', 'LOW'],
  ];
  return (
    <AppShell active="/checks">
      <PageHeader title="My Checks" subtitle="Review your saved export risk assessments and continue where you left off." action={<PrimaryButton onClick={() => router.push('/check/new?new=1')}>New Export Risk Check</PrimaryButton>} />
      <section className="content-card">
        <div className="card-heading"><h2>Recent Checks</h2><span>5 demo records</span></div>
        <div className="table-wrap">
          <table><thead><tr><th>Date</th><th>Product</th><th>Destination</th><th>Buyer / Importer</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row[0]}>{row.slice(0, 4).map((cell) => <td key={cell}>{cell}</td>)}<td><StatusBadge level={row[4]} /></td><td><button className="icon-button" onClick={() => router.push('/check/results/demo')}><ArrowRight size={15} /></button></td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

export function RegulationsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All topics');
  const [status, setStatus] = useState('All statuses');
  const [results, setResults] = useState<Regulation[]>(regulations);
  useEffect(() => { searchRegulations(query, { category, status }).then(setResults); }, [query, category, status]);
  return (
    <AppShell active="/regulations">
      <PageHeader eyebrow="GLOBAL COMPLIANCE  •  SMARTER TRADE  •  BRIGHTER TOMORROW" title="Regulations" subtitle="Search official trade regulations, compliance requirements, and guidance by market, product, and topic." />
      <section className="reg-search content-card">
        <div className="search-row">
          <div className="search-input"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by keyword, product, HS code, or regulation..." /></div>
          <button className="outline-button"><ShieldCheck size={15} /> Official Sources</button>
          <button className="outline-button"><Clock3 size={15} /> Latest Updates</button>
        </div>
        <div className="filter-row">
          <FilterSelect label="Destination Market" value="United Kingdom" options={['United Kingdom', 'All markets']} onChange={() => {}} />
          <FilterSelect label="Topic" value={category} options={['All topics', 'Sustainability', 'Market Access', 'Export Control', 'Sanctions & Restricted Parties']} onChange={setCategory} />
          <FilterSelect label="Product Sector" value="All sectors" options={['All sectors']} onChange={() => {}} />
          <FilterSelect label="Regulation Status" value={status} options={['All statuses', 'In Force', 'Upcoming', 'Transitional', 'Expired / Superseded']} onChange={setStatus} />
        </div>
      </section>
      <section className="category-block">
        <h2>Key Regulation Categories</h2>
        <div className="category-grid">
          {[['Export Control', FileText, 'Licensing, end use, dual-use.', 'green'], ['Market Access', Box, 'Product standards, labelling, import requirements.', 'blue'], ['Sustainability', Leaf, 'CBAM, carbon pricing, environmental compliance.', 'green'], ['Sanctions & Restricted Parties', Users, 'Entity lists, trade restrictions, embargoes.', 'red']].map(([title, Icon, copy, tone]) => (
            <div className="category-card" key={title as string}><span className={cx('feature-icon', `tone-${tone}`)}><Icon size={20} /></span><div><strong>{title as string}</strong><p>{copy as string}</p></div></div>
          ))}
        </div>
      </section>
      <section className="reg-results">
        <div className="results-main">
          <div className="card-heading"><h2>Matched Regulations</h2><span>{results.length} results</span></div>
          {results.map((regulation) => <RegulationCard regulation={regulation} key={regulation.id} />)}
          {!results.length && <div className="empty-state compact"><Search size={25} /><h3>No matching regulations</h3><p>Try a broader search or another topic.</p></div>}
        </div>
        <aside className="sources-side content-card">
          <div className="card-heading"><h3>Official Sources</h3><button>View All <ArrowRight size={14} /></button></div>
          {['HMRC', 'UK Government', 'UK Export Control Joint Unit', 'Office of Financial Sanctions Implementation'].map((source) => (
            <div className="source-mini" key={source}><span className="source-seal"><Globe2 size={15} /></span><div><strong>{source}</strong><small>Official guidance and updates</small></div><ExternalLink size={14} /></div>
          ))}
        </aside>
      </section>
    </AppShell>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>
      <ChevronDown size={14} />
    </label>
  );
}

function RegulationCard({ regulation }: { regulation: Regulation }) {
  const lifecycle = regulation.effectiveFrom
    ? new Date(regulation.effectiveFrom) > new Date() ? 'UPCOMING' : 'ACTIVE'
    : regulation.status;
  return (
    <article className="reg-card">
      <span className="feature-icon tone-green"><Leaf size={19} /></span>
      <div className="reg-copy">
        <div className="reg-title"><h3>{regulation.title}</h3><ExternalLink size={14} /></div>
        <span className="jurisdiction">{regulation.jurisdiction}</span>
        <p>{regulation.summary}</p>
        <span className="topic-pill">{regulation.category}</span>
      </div>
      <div className="reg-meta">
        <button className="outline-button">View Details <ArrowRight size={14} /></button>
        <div className="reg-dates">
          <small><Clock3 size={13} /> Effective from<br /><strong>{regulation.effectiveDate}</strong></small>
          <small><FileCheck2 size={13} /> Last checked<br /><strong>{regulation.lastChecked}</strong></small>
        </div>
        <span className={cx('lifecycle-pill', lifecycle === 'ACTIVE' ? 'lp-active' : lifecycle === 'UPCOMING' ? 'lp-upcoming' : 'lp-default')}>{lifecycle}</span>
      </div>
    </article>
  );
}

export function SimplePage({ title, subtitle, active, icon: Icon }: { title: string; subtitle: string; active: string; icon: typeof Settings }) {
  return (
    <AppShell active={active}>
      <div className="empty-state large">
        <span className="feature-icon tone-blue"><Icon size={26} /></span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <span className="coming-soon">Coming in the next build</span>
      </div>
    </AppShell>
  );
}
